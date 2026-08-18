import { db } from '../config/firebase';
import { doc, collection, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

/**
 * Firestore Service helper functions.
 * 
 * Provides scoping and reference generation for user documents, resources, and tasks.
 */

/**
 * Get the reference to a specific user's root document.
 * Path: users/{userId}
 */
export function getUserDocRef(userId) {
  if (!userId) throw new Error('userId is required for getUserDocRef');
  return doc(db, 'users', userId);
}

/**
 * Get the reference to a specific user's resources subcollection.
 * Path: users/{userId}/resources
 */
export function getResourcesColRef(userId) {
  if (!userId) throw new Error('userId is required for getResourcesColRef');
  return collection(db, 'users', userId, 'resources');
}

/**
 * Get the reference to a specific user's tasks subcollection.
 * Path: users/{userId}/tasks
 */
export function getTasksColRef(userId) {
  if (!userId) throw new Error('userId is required for getTasksColRef');
  return collection(db, 'users', userId, 'tasks');
}

/**
 * Fetch all resources for a user.
 */
export async function getResources(userId) {
  const colRef = getResourcesColRef(userId);
  const q = query(colRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

/**
 * Add a new resource for a user.
 */
export async function addResource(userId, resourceData) {
  const colRef = getResourcesColRef(userId);
  const docRef = await addDoc(colRef, {
    ...resourceData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Update a specific resource.
 */
export async function updateResource(userId, resourceId, updates) {
  if (!userId || !resourceId) throw new Error('userId and resourceId are required');
  const docRef = doc(db, 'users', userId, 'resources', resourceId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

/**
 * Delete a specific resource.
 */
export async function deleteResource(userId, resourceId) {
  if (!userId || !resourceId) throw new Error('userId and resourceId are required');
  const docRef = doc(db, 'users', userId, 'resources', resourceId);
  await deleteDoc(docRef);
}
