import { useEffect, useState, useRef } from 'react'
import { Plus, Check, Heart, Image as ImageIcon, Trash2, Calendar, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import confetti from 'canvas-confetti'
import html2canvas from 'html2canvas'
import { format, isToday, isTomorrow } from 'date-fns'
import { ko } from 'date-fns/locale'

// Calculate D-Day (Baby's birth)
const ANNIVERSARY_DATE = new Date('2025-05-01')
const getDDay = () => {
  const diffTime = Math.abs(new Date() - ANNIVERSARY_DATE)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return `👶 태어난 지 D+${diffDays}일`
}

export default function App() {
  const [todos, setTodos] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTodo, setNewTodo] = useState('')
  const [assignee, setAssignee] = useState('both')
  const appRef = useRef(null)

  useEffect(() => {
    fetchTodos()

    const subscription = supabase
      .channel('todos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, payload => {
        if (payload.eventType === 'INSERT') {
          setTodos(prev => [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setTodos(prev => prev.map(t => (t.id === payload.new.id ? payload.new : t)))
        } else if (payload.eventType === 'DELETE') {
          setTodos(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])

  const fetchTodos = async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) setTodos(data)
  }

  const addTodo = async (e) => {
    e.preventDefault()
    if (!newTodo.trim()) return

    const { error } = await supabase
      .from('todos')
      .insert([{ text: newTodo, assignee, completed: false }])

    if (!error) {
      setNewTodo('')
      setAssignee('both')
      setIsModalOpen(false)
    }
  }

  const toggleTodo = async (id, currentStatus) => {
    const newStatus = !currentStatus
    
    if (newStatus) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff6b6b', '#4ecdc4', '#ffe66d']
      })
    }

    // Optimistic update
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: newStatus } : t))

    await supabase
      .from('todos')
      .update({ completed: newStatus })
      .eq('id', id)
  }

  const deleteTodo = async (id) => {
    // Optimistic update
    setTodos(prev => prev.filter(t => t.id !== id))
    await supabase.from('todos').delete().eq('id', id)
  }

  const exportImage = async () => {
    if (!appRef.current) return
    
    try {
      const canvas = await html2canvas(appRef.current, {
        backgroundColor: window.matchMedia('(prefers-color-scheme: dark)').matches ? '#1a202c' : '#f6f8fd',
        scale: 2,
      })
      
      const image = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = image
      link.download = `our-todo-${format(new Date(), 'yyyyMMdd')}.png`
      link.click()
    } catch (err) {
      console.error('Failed to export image', err)
    }
  }

  const completedCount = todos.filter(t => t.completed).length
  const dday = getDDay()

  return (
    <div className="app-wrapper" ref={appRef}>
      <header className="header">
        <div className="d-day-badge">{dday}</div>
        <h1 style={{ marginTop: '16px' }}>Our Todo List</h1>
      </header>

      <div className="glass-container stats-card">
        <div className="stats-info">
          <h3>함께 완료한 일</h3>
          <p>{completedCount}개 👏</p>
        </div>
        <button className="export-btn" onClick={exportImage}>
          <ImageIcon size={16} />
          기록 저장
        </button>
      </div>

      <div className="todo-list glass-container" style={{ padding: '8px' }}>
        {todos.length === 0 ? (
          <div className="empty-state">
            <Heart />
            <p>아직 등록된 할 일이 없어요.<br/>함께할 일을 추가해 보세요!</p>
          </div>
        ) : (
          todos.map(todo => (
            <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
              <button 
                className={`checkbox ${todo.completed ? 'checked' : ''}`}
                onClick={() => toggleTodo(todo.id, todo.completed)}
              >
                <Check size={14} strokeWidth={3} />
              </button>
              
              <div className="todo-content">
                <span className="todo-text">{todo.text}</span>
                <div className="todo-meta">
                  <span className={`assignee ${todo.assignee}`}>
                    {todo.assignee === 'both' ? '둘 다' : todo.assignee === 'me' ? '나' : '너'}
                  </span>
                  {todo.created_at && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={10} />
                      {format(new Date(todo.created_at), 'MMM d일', { locale: ko })}
                    </span>
                  )}
                </div>
              </div>

              <button className="delete-btn" onClick={() => deleteTodo(todo.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <button className="fab" onClick={() => setIsModalOpen(true)}>
        <Plus size={24} />
      </button>

      <div className={`modal-overlay ${isModalOpen ? 'open' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">새로운 할 일</h2>
            <button className="close-btn" onClick={() => setIsModalOpen(false)}>
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={addTodo}>
            <div className="form-group">
              <input
                type="text"
                className="input-text"
                placeholder="무엇을 함께 할까요?"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                autoFocus={isModalOpen}
              />
            </div>
            
            <div className="form-group">
              <label>담당자</label>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segment-btn ${assignee === 'both' ? 'active' : ''}`}
                  onClick={() => setAssignee('both')}
                >
                  둘 다
                </button>
                <button
                  type="button"
                  className={`segment-btn ${assignee === 'me' ? 'active' : ''}`}
                  onClick={() => setAssignee('me')}
                >
                  나
                </button>
                <button
                  type="button"
                  className={`segment-btn ${assignee === 'you' ? 'active' : ''}`}
                  onClick={() => setAssignee('you')}
                >
                  너
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn">
              추가하기
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
