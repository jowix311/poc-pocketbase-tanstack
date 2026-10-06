import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPocketBase, POCKETBASE_URL, type Todo } from '../lib/pocketbase'

export const Route = createFileRoute('/')({ component: TodosPage })

type Filter = 'all' | 'active' | 'completed'

function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  // Initial fetch + realtime subscription (no auth, single shared list)
  useEffect(() => {
    const pb = getPocketBase()
    let cancelled = false

    async function init() {
      try {
        setLoading(true)
        setError(null)
        const records = await pb
          .collection('todos')
          .getList<Todo>(1, 100, { sort: '-created' })
        if (cancelled) return
        setTodos(records.items)
        setConnected(true)

        await pb.collection('todos').subscribe<Todo>('*', (e) => {
          setConnected(true)
          if (e.action === 'create') {
            setTodos((prev) =>
              prev.some((t) => t.id === e.record.id)
                ? prev
                : [e.record, ...prev],
            )
          } else if (e.action === 'update') {
            setTodos((prev) =>
              prev.map((t) => (t.id === e.record.id ? e.record : t)),
            )
          } else if (e.action === 'delete') {
            setTodos((prev) => prev.filter((t) => t.id !== e.record.id))
          }
        })
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setConnected(false)
          setError(
            'Could not reach PocketBase. Run `docker compose up -d`, create the `todos` collection (or let the bundled migration run), and check VITE_POCKETBASE_URL.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
      pb.collection('todos').unsubscribe().catch(() => {})
    }
  }, [])

  const addTodo = useCallback(async () => {
    const title = newTitle.trim()
    if (!title || saving) return
    setSaving(true)
    setError(null)
    try {
      const pb = getPocketBase()
      // Optimistic realtime will insert via subscribe; but also handle direct result
      const record = await pb
        .collection('todos')
        .create<Todo>({ title, completed: false })
      setTodos((prev) =>
        prev.some((t) => t.id === record.id) ? prev : [record, ...prev],
      )
      setNewTitle('')
    } catch (err) {
      console.error(err)
      setError('Failed to create todo. Is PocketBase running?')
    } finally {
      setSaving(false)
    }
  }, [newTitle, saving])

  const toggleTodo = useCallback(async (todo: Todo) => {
    try {
      await getPocketBase()
        .collection('todos')
        .update(todo.id, { completed: !todo.completed })
    } catch (err) {
      console.error(err)
      setError('Failed to update todo.')
    }
  }, [])

  const removeTodo = useCallback(async (id: string) => {
    // Optimistic delete for snappy UI; realtime event confirms it
    setTodos((prev) => prev.filter((t) => t.id !== id))
    try {
      await getPocketBase().collection('todos').delete(id)
    } catch (err) {
      console.error(err)
      setError('Failed to delete todo.')
    }
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editingId) return
    const title = editingTitle.trim()
    if (!title) {
      setEditingId(null)
      return
    }
    try {
      await getPocketBase().collection('todos').update(editingId, { title })
    } catch (err) {
      console.error(err)
      setError('Failed to rename todo.')
    } finally {
      setEditingId(null)
    }
  }, [editingId, editingTitle])

  const clearCompleted = useCallback(async () => {
    const done = todos.filter((t) => t.completed)
    if (done.length === 0) return
    setTodos((prev) => prev.filter((t) => !t.completed))
    try {
      await Promise.all(
        done.map((t) => getPocketBase().collection('todos').delete(t.id)),
      )
    } catch (err) {
      console.error(err)
      setError('Failed to clear completed todos.')
    }
  }, [todos])

  const visible = useMemo(() => {
    if (filter === 'active') return todos.filter((t) => !t.completed)
    if (filter === 'completed') return todos.filter((t) => t.completed)
    return todos
  }, [todos, filter])

  const remaining = todos.filter((t) => !t.completed).length

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Todos</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {remaining} left · PocketBase realtime · no login
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              connected
                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
            }`}
            title={POCKETBASE_URL}
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            {connected ? 'live' : 'offline'}
          </span>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
            <div className="mt-1 text-xs opacity-80">
              PB: {POCKETBASE_URL} · Admin UI: {POCKETBASE_URL}/_/
            </div>
          </div>
        )}

        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addTodo()
          }}
        >
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={saving || !newTitle.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        </form>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {loading ? (
            <p className="p-6 text-sm text-zinc-500">Loading todos…</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">
              {todos.length === 0
                ? 'No todos yet. Add your first one above — open a second tab to see realtime sync.'
                : 'Nothing matches this filter.'}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {visible.map((todo) => (
                <li key={todo.id} className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo)}
                    className="h-4 w-4 accent-zinc-900"
                    aria-label={`Mark ${todo.title} as ${todo.completed ? 'active' : 'completed'}`}
                  />
                  {editingId === todo.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  ) : (
                    <button
                      className={`flex-1 text-left text-sm ${
                        todo.completed
                          ? 'text-zinc-400 line-through'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                      onDoubleClick={() => {
                        setEditingId(todo.id)
                        setEditingTitle(todo.title)
                      }}
                      title="Double-click to rename"
                    >
                      {todo.title}
                    </button>
                  )}
                  <button
                    onClick={() => removeTodo(todo.id)}
                    className="rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                    aria-label={`Delete ${todo.title}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="mt-4 flex items-center justify-between text-sm">
          <div className="flex gap-1">
            {(['all', 'active', 'completed'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 capitalize ${
                  filter === f
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={clearCompleted}
            disabled={!todos.some((t) => t.completed)}
            className="text-zinc-500 hover:text-red-600 disabled:opacity-40"
          >
            Clear completed
          </button>
        </footer>
      </main>
    </div>
  )
}
