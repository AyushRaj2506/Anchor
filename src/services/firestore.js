import { db } from '../config/firebase';
import { resourceRecord, taskRecord } from '../utils/records';
import { analysisTaskId } from '../utils/tasks';
import { doc, collection, getDocs, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, runTransaction } from 'firebase/firestore/lite';

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
  
  return snapshot.docs.map(docSnap => resourceRecord(docSnap.data(), docSnap.id));
}

/**
 * Add a new resource for a user. Supports custom pre-determined document IDs.
 */
export async function addResource(userId, resourceData, resourceId = null) {
  const colRef = getResourcesColRef(userId);
  if (resourceId) {
    const docRef = doc(db, 'users', userId, 'resources', resourceId);
    await setDoc(docRef, {
      ...resourceData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return resourceId;
  } else {
    const docRef = await addDoc(colRef, {
      ...resourceData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }
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

/**
 * Fetch all tasks for a user.
 */
export async function getTasks(userId) {
  const colRef = getTasksColRef(userId);
  const q = query(colRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(docSnap => taskRecord(docSnap.data(), docSnap.id));
}

/**
 * Add a new task for a user.
 */
export async function addTask(userId, taskData) {
  const colRef = getTasksColRef(userId);
  const docRef = await addDoc(colRef, {
    ...taskData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Update a specific task.
 */
export async function updateTask(userId, taskId, updates) {
  if (!userId || !taskId) throw new Error('userId and taskId are required');
  const docRef = doc(db, 'users', userId, 'tasks', taskId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

/**
 * Delete a specific task.
 */
export async function deleteTask(userId, taskId) {
  if (!userId || !taskId) throw new Error('userId and taskId are required');
  const docRef = doc(db, 'users', userId, 'tasks', taskId);
  await deleteDoc(docRef);
}

// A transaction and deterministic ID prevent duplicate AI tasks across retries/tabs.
export async function addAnalysisTask(userId, resourceId, taskData) {
  if (!userId || !resourceId) throw new Error('A user and resource are required.');
  const id = await analysisTaskId(resourceId, taskData.title);
  const ref = doc(db, 'users', userId, 'tasks', id);
  return runTransaction(db, async transaction => {
    const existing = await transaction.get(ref);
    if (existing.exists()) return { created: false, task: taskRecord(existing.data(), id) };
    transaction.set(ref, { ...taskData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { created: true, task: { ...taskData, id, createdAt: new Date() } };
  });
}
