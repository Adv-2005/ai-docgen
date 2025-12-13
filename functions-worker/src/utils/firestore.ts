// functions-worker/src/utils/firestore.ts

/**
 * Remove undefined values from an object recursively
 * Firestore doesn't accept undefined values
 */
export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefined(item)) as any;
  }

  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = (obj as any)[key];
        if (value !== undefined) {
          cleaned[key] = cleanUndefined(value);
        }
      }
    }
    return cleaned;
  }

  return obj;
}

/**
 * Convert objects to plain JSON-serializable format
 * Removes functions, symbols, and other non-serializable types
 */
export function toFirestoreData<T>(data: T): any {
  return JSON.parse(JSON.stringify(cleanUndefined(data)));
}