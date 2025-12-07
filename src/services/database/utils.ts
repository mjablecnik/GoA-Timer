// src/services/database/utils.ts

/**
 * Helper function to generate UUID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get device ID from local storage or generate a new one
 */
export function getDeviceId(): string {
  const storageKey = 'guards-of-atlantis-device-id';
  
  let deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    
    deviceId = `device_${timestamp}_${randomPart}`;
    localStorage.setItem(storageKey, deviceId);
  }
  
  return deviceId;
}