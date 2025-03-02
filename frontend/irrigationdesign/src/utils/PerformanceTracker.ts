// Utilitaire pour tracer les performances dans l'application
export class PerformanceTracker {
  private static perfMarkers: string[] = [];
  private static measures: {name: string, duration: number, timestamp: number}[] = [];
  private static isActive: boolean = true;

  /**
   * Active ou désactive le suivi des performances
   */
  public static setActive(active: boolean): void {
    this.isActive = active;
  }

  /**
   * Démarre le suivi d'une fonction ou section de code
   * @param name Nom de la section à mesurer
   */
  public static start(name: string): void {
    if (!this.isActive) return;
    
    const markName = `start-${name}`;
    performance.mark(markName);
    this.perfMarkers.push(markName);
  }

  /**
   * Termine le suivi d'une fonction ou section de code
   * @param name Nom de la section à mesurer (doit correspondre au nom utilisé avec start)
   */
  public static end(name: string): void {
    if (!this.isActive) return;
    
    const markName = `end-${name}`;
    const startName = `start-${name}`;
    performance.mark(markName);
    
    try {
      performance.measure(name, startName, markName);
      const entries = performance.getEntriesByName(name, 'measure');
      
      if (entries.length > 0) {
        this.measures.push({
          name,
          duration: entries[0].duration,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error(`Erreur lors de la mesure de performance pour ${name}:`, error);
    }
    
    this.perfMarkers.push(markName);
  }

  /**
   * Trace automatiquement l'exécution d'une fonction (début et fin)
   * @param target Classe cible
   * @param propertyKey Nom de la méthode
   * @param descriptor Descripteur de la méthode
   */
  public static trackMethod() {
    return function(
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      
      descriptor.value = function(...args: any[]) {
        const className = this.constructor.name;
        const methodName = propertyKey;
        const perfName = `${className}.${methodName}`;
        
        PerformanceTracker.start(perfName);
        try {
          return originalMethod.apply(this, args);
        } finally {
          PerformanceTracker.end(perfName);
        }
      };
      
      return descriptor;
    };
  }

  /**
   * Trace automatiquement l'exécution d'une fonction asynchrone (début et fin)
   */
  public static trackAsyncMethod() {
    return function(
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function(...args: any[]) {
        const className = this.constructor.name;
        const methodName = propertyKey;
        const perfName = `${className}.${methodName}`;
        
        PerformanceTracker.start(perfName);
        try {
          return await originalMethod.apply(this, args);
        } finally {
          PerformanceTracker.end(perfName);
        }
      };
      
      return descriptor;
    };
  }

  /**
   * Génère un rapport de performance au format JSON
   */
  public static generateReport(): any[] {
    return this.measures.map(measure => ({
      name: measure.name,
      duration: measure.duration.toFixed(2) + ' ms',
      timestamp: new Date(measure.timestamp).toISOString()
    }));
  }

  /**
   * Télécharge le rapport de performance au format JSON
   * Utilise l'API FileSystem Access si disponible pour permettre à l'utilisateur
   * de choisir où sauvegarder le fichier
   */
  public static async downloadReport(): Promise<void> {
    const report = this.generateReport();
    const jsonContent = JSON.stringify(report, null, 2);
    const filename = `performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    
    // Vérifier si l'API File System Access est disponible
    if ('showSaveFilePicker' in window) {
      try {
        // Permettre à l'utilisateur de choisir où sauvegarder le fichier
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Fichier JSON',
            accept: {'application/json': ['.json']}
          }]
        });
        
        // Créer un FileSystemWritableFileStream pour écrire dans le fichier
        const writable = await fileHandle.createWritable();
        
        // Écrire le contenu dans le fichier
        await writable.write(jsonContent);
        
        // Fermer le flux d'écriture lorsque terminé
        await writable.close();
        
        console.log('📊 Rapport de performance sauvegardé avec succès !');
      } catch (error) {
        // L'utilisateur a annulé ou une erreur s'est produite
        console.error('Erreur lors de la sauvegarde du rapport:', error);
        
        // Revenir à la méthode de téléchargement classique si l'utilisateur annule ou en cas d'erreur
        this.fallbackDownload(jsonContent, filename);
      }
    } else {
      // API non supportée, utiliser la méthode classique
      this.fallbackDownload(jsonContent, filename);
    }
    
    // Nettoyer les mesures
    this.clearMeasures();
  }
  
  /**
   * Méthode de téléchargement classique comme solution de repli
   * utilisée si l'API File System Access n'est pas disponible
   */
  private static fallbackDownload(content: string, filename: string): void {
    const blob = new Blob([content], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Nettoyer
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Nettoie toutes les mesures et marqueurs
   */
  public static clearMeasures(): void {
    this.perfMarkers.forEach(marker => performance.clearMarks(marker));
    this.measures.forEach(measure => performance.clearMeasures(measure.name));
    this.perfMarkers = [];
    this.measures = [];
  }
} 