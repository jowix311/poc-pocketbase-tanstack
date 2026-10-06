import PocketBase from 'pocketbase'

export const POCKETBASE_URL =
  import.meta.env.VITE_POCKETBASE_URL ?? 'http://127.0.0.1:8090'

let singleton: PocketBase | null = null

export function getPocketBase(): PocketBase {
  if (!singleton) {
    singleton = new PocketBase(POCKETBASE_URL)
    // Required for realtime subscriptions + rapid successive requests
    singleton.autoCancellation(false)
  }
  return singleton
}

export interface Todo {
  id: string
  collectionId: string
  collectionName: 'todos'
  title: string
  completed: boolean
  created: string
  updated: string
}
