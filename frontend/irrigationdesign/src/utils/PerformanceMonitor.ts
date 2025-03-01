/**
 * Utilitaire pour surveiller et analyser les performances de l'application
 */
class PerformanceMonitor {
  private measures: Record<string, number[]> = {};
  private isActive: boolean = false;
  private iterationCount: number = 0;
  
  /**
   * Commence à surveiller les performances
   */
  start() {
    this.isActive = true;
    this.measures = {};
    this.iterationCount = 0;
    console.log('Performance monitoring started');
    
    // Observer les mesures de performance
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          if (!this.measures[entry.name]) {
            this.measures[entry.name] = [];
          }
          this.measures[entry.name].push(entry.duration);
        }
      }
    });
    
    observer.observe({ entryTypes: ['measure'] });
    return observer;
  }
  
  /**
   * Arrête la surveillance et génère un rapport
   */
  stop(observer?: PerformanceObserver) {
    this.isActive = false;
    if (observer) {
      observer.disconnect();
    }
    
    console.log('Performance monitoring stopped');
    return this.generateReport();
  }
  
  /**
   * Signale une nouvelle itération (par ex. un déplacement de point)
   */
  iteration() {
    if (!this.isActive) return;
    this.iterationCount++;
  }
  
  /**
   * Génère un rapport complet des mesures de performance
   */
  generateReport() {
    const report: Record<string, any> = {
      iterations: this.iterationCount,
      measures: {}
    };
    
    for (const [name, durations] of Object.entries(this.measures)) {
      if (durations.length === 0) continue;
      
      const total = durations.reduce((sum, val) => sum + val, 0);
      const average = total / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      
      report.measures[name] = {
        count: durations.length,
        average: average.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2),
        total: total.toFixed(2)
      };
    }
    
    console.table(report.measures);
    return report;
  }
  
  /**
   * Efface toutes les marques et mesures de performance enregistrées
   */
  clearMarks() {
    performance.clearMarks();
    performance.clearMeasures();
  }
}

// Exporter une instance unique pour toute l'application
export const performanceMonitor = new PerformanceMonitor(); 