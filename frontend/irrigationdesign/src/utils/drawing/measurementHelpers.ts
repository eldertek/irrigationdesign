/**
 * Utilitaires pour l'affichage et la gestion des mesures
 */
import L from 'leaflet';

/**
 * Crée et affiche un message d'aide sur la carte
 * @param message Message HTML à afficher
 * @returns Élément HTML créé
 */
export const showHelpMessage = (message: string): HTMLElement => {
  // Supprimer tous les messages d'aide existants
  const existingMessages = document.querySelectorAll('.drawing-help-message');
  existingMessages.forEach(msg => msg.remove());

  const helpMsg = L.DomUtil.create('div', 'drawing-help-message');
  helpMsg.innerHTML = message;
  helpMsg.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 2000;
    pointer-events: none;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  `;
  document.body.appendChild(helpMsg);
  return helpMsg;
};

/**
 * Crée et affiche une tooltip de mesure à une position donnée
 * @param position Position sur la carte
 * @param text Texte à afficher
 * @param map Instance de la carte Leaflet
 * @returns Élément HTML de la tooltip
 */
export const showMeasureTooltip = (position: L.LatLng, text: string, map: L.Map | null): HTMLElement => {
  const measureDiv = L.DomUtil.create('div', 'measure-tooltip');
  measureDiv.innerHTML = text;
  measureDiv.style.cssText = `
    position: fixed;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 2000;
    pointer-events: none;
    white-space: pre-line;
  `;
  document.body.appendChild(measureDiv);

  // Positionner la tooltip
  if (map) {
    const point = map.latLngToContainerPoint(position);
    measureDiv.style.left = `${point.x + 10}px`;
    measureDiv.style.top = `${point.y - 25}px`;
  }

  return measureDiv;
};

/**
 * Fonction throttlée pour mettre à jour une tooltip de mesure
 * @param measureDiv Élément HTML de la tooltip
 * @param position Nouvelle position
 * @param text Nouveau texte
 * @param map Instance de la carte Leaflet
 */
export const updateMeasureTooltip = (
  measureDiv: HTMLElement, 
  position: L.LatLng, 
  text: string, 
  map: L.Map | null
): void => {
  if (!measureDiv) return;
  
  // Mettre à jour le contenu
  measureDiv.innerHTML = text;
  
  // Mettre à jour la position
  if (map) {
    const point = map.latLngToContainerPoint(position);
    measureDiv.style.left = `${point.x + 10}px`;
    measureDiv.style.top = `${point.y - 25}px`;
  }
};

/**
 * Throttle function to limit execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T, 
  delay: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  return function(this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCall < delay) return;
    lastCall = now;
    return fn.apply(this, args);
  };
}

/**
 * Debounce function to delay execution until after a period of inactivity
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T, 
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number;
  return function(this: any, ...args: Parameters<T>) {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Convertit un MouseEvent standard en MouseEvent pour Leaflet
 */
export const convertMouseEvent = (e: MouseEvent): MouseEvent => {
  return {
    ...e,
    clientX: e.clientX,
    clientY: e.clientY,
    button: e.button || 0,
    buttons: e.buttons || 0,
    altKey: e.altKey || false,
  } as MouseEvent;
}; 