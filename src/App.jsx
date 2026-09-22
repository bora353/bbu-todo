import { useEffect, useState } from 'react'
import { Plus, Check, Heart, Trash2, Clock, X, Bell, RotateCcw } from 'lucide-react'
import { supabase } from './lib/supabase'
import confetti from 'canvas-confetti'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

// Calculate D-Day (Baby's birth)
const ANNIVERSARY_DATE = new Date('2025-05-01')
const getDDay = () => {
  const diffTime = Math.abs(new Date() - ANNIVERSARY_DATE)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return `👶 태어난 지 D+${diffDays}일`
}

// Helper to handle push subscription
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function App() {
  const [todos, setTodos] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTodo, setNewTodo] = useState('')
  const [assignee, setAssignee] = useState('both')
  const [dueDate, setDueDate] = useState('')
  const [viewCompleted, setViewCompleted] = useState(false)
  const [viewDeleted, setViewDeleted] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  // Profile
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('currentUser') || null)

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

  const getInitialDueDate = () => {
    return '06:30';
  }

  const handleDateChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setDueDate('');
      return;
    }
    const [h, m] = val.split(':').map(Number);
    let roundedM = Math.round(m / 5) * 5;
    let finalH = h;
    if (roundedM === 60) {
      finalH = (finalH + 1) % 24;
      roundedM = 0;
    }
    const formattedH = String(finalH).padStart(2, '0');
    const formattedM = String(roundedM).padStart(2, '0');
    setDueDate(`${formattedH}:${formattedM}`);
  }

  const fetchTodos = async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) setTodos(data)
  }

  const openAddModal = () => {
    setEditingId(null)
    setNewTodo('')
    setAssignee('both')
    setDueDate(getInitialDueDate())
    setIsModalOpen(true)
  }

  const openEditModal = (todo) => {
    setEditingId(todo.id)
    setNewTodo(todo.text)
    setAssignee(todo.assignee)
    
    let timeOnly = '';
    if (todo.due_date) {
      const d = new Date(todo.due_date);
      timeOnly = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    setDueDate(timeOnly)
    setIsModalOpen(true)
  }

  const saveTodo = async (e) => {
    e.preventDefault()
    if (!newTodo.trim()) return

    let isoDueDate = null;
    if (dueDate) {
      const [h, m] = dueDate.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      isoDueDate = d.toISOString();
    }

    const todoData = { 
      text: newTodo, 
      assignee, 
      due_date: isoDueDate
    }

    if (editingId) {
      // Edit
      setTodos(prev => prev.map(t => t.id === editingId ? { ...t, ...todoData } : t))
      await supabase.from('todos').update(todoData).eq('id', editingId)
    } else {
      // Add
      todoData.completed = false
      todoData.is_deleted = false
      await supabase.from('todos').insert([todoData])
    }

    setIsModalOpen(false)
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

    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: newStatus } : t))
    await supabase.from('todos').update({ completed: newStatus }).eq('id', id)
  }

  const softDeleteTodo = async (id) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, is_deleted: true } : t))
    await supabase.from('todos').update({ is_deleted: true }).eq('id', id)
  }

  const restoreTodo = async (id) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, is_deleted: false } : t))
    await supabase.from('todos').update({ is_deleted: false }).eq('id', id)
  }

  const hardDeleteTodo = async (id) => {
    setTodos(prev => prev.filter(t => t.id !== id))
    await supabase.from('todos').delete().eq('id', id)
  }

  const handleProfileSelect = async (user) => {
    localStorage.setItem('currentUser', user)
    setCurrentUser(user)
    
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const vapidPublicKey = "BLCbyjtnBK8rB7Md_aEtONwHdugGwwKQRKILzCOB5h-QXFZTEf4SshBrnFfn-BAJFnzLDeL52j3tl5jRx2h_AJk";
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        
        try {
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          });
          
          await supabase.from('subscriptions').upsert({
            user_name: user,
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
              auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
            }
          }, { onConflict: 'endpoint' });
          
        } catch (err) {
          console.error("Failed to subscribe to push", err);
        }
      }
    }
  }

  const handlePoke = async (taskText) => {
    const target = currentUser === '가은' ? '경민' : '가은';
    try {
      const res = await fetch('/api/poke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: currentUser, target: target, taskText })
      });
      if (res.ok) {
        alert(`${target}님을 콕 찔렀어요! 👉`);
      } else if (res.status === 404) {
        alert(`${target}님이 아직 앱에 접속하지 않아 알림을 받을 수 없습니다.`);
      } else {
        alert('콕 찌르기에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('에러가 발생했습니다.');
    }
  }

  if (!currentUser) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center' }}>
        <div className="glass-container" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <h2>누구신가요?</h2>
          <p style={{ color: 'var(--text-muted)', margin: '12px 0 24px' }}>알림을 정확히 받기 위해 선택해주세요!</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="submit-btn" style={{ flex: 1, marginTop: 0 }} onClick={() => handleProfileSelect('가은')}>가은</button>
            <button className="submit-btn" style={{ flex: 1, marginTop: 0, background: '#4ecdc4' }} onClick={() => handleProfileSelect('경민')}>경민</button>
          </div>
        </div>
      </div>
    )
  }

  const activeTodos = todos.filter(t => !t.is_deleted)
  const uncompletedTodos = activeTodos.filter(t => !t.completed).sort((a, b) => {
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  const completedTodos = activeTodos.filter(t => t.completed)
  const deletedTodos = todos.filter(t => t.is_deleted)
  
  const dday = getDDay()

  return (
    <div className="app-wrapper" style={{ paddingBottom: '100px' }}>
      <header className="header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="d-day-badge">{dday}</div>
      </header>

      {/* Uncompleted List */}
      <div className="todo-list glass-container" style={{ padding: '8px', flex: 'none' }}>
        {uncompletedTodos.length === 0 ? (
          <div className="empty-state">
            <Heart color="var(--glass-border)" />
            <p>모든 할 일을 마쳤어요!<br/>여유를 즐기세요 🎉</p>
          </div>
        ) : (
          uncompletedTodos.map(todo => (
            <div key={todo.id} className="todo-item compact" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  className={`checkbox`}
                  onClick={() => toggleTodo(todo.id, todo.completed)}
                >
                  <Check size={14} strokeWidth={3} />
                </button>
                <span 
                  className="todo-text" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => openEditModal(todo)}
                >
                  {todo.text}
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0px', paddingLeft: '36px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`assignee ${todo.assignee}`}>
                    {todo.assignee === 'both' ? '쀼' : todo.assignee === 'me' ? '가은' : '경민'}
                  </span>
                  {todo.due_date && (
                    <span className="todo-date">
                      <Clock size={10} />
                      {format(new Date(todo.due_date), 'a h:mm', { locale: ko })}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="delete-btn" onClick={() => handlePoke(todo.text)} title="상대방 콕 찌르기">
                    <Bell size={16} />
                  </button>
                  <button className="delete-btn" onClick={() => softDeleteTodo(todo.id)} title="삭제">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Completed List Toggle */}
      {completedTodos.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <button 
            className="toggle-completed-btn"
            onClick={() => setViewCompleted(!viewCompleted)}
          >
            {viewCompleted ? '다한 리스트 닫기' : `다한 리스트 보기 (${completedTodos.length}개)`}
          </button>
          
          {viewCompleted && (
            <div className="todo-list glass-container" style={{ padding: '8px', marginTop: '12px' }}>
              {completedTodos.map(todo => (
                <div key={todo.id} className="todo-item compact completed" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      className="checkbox checked"
                      onClick={() => toggleTodo(todo.id, todo.completed)}
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>
                    <span 
                      className="todo-text"
                      style={{ cursor: 'pointer' }}
                      onClick={() => openEditModal(todo)}
                    >
                      {todo.text}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0px', paddingLeft: '36px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className={`assignee ${todo.assignee}`}>
                        {todo.assignee === 'both' ? '쀼' : todo.assignee === 'me' ? '가은' : '경민'}
                      </span>
                      {todo.due_date && (
                        <span className="todo-date">
                          <Clock size={10} />
                          {format(new Date(todo.due_date), 'a h:mm', { locale: ko })}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="delete-btn" onClick={() => softDeleteTodo(todo.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Deleted List Toggle */}
      {deletedTodos.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <button 
            className="toggle-completed-btn"
            style={{ color: '#ff6b6b' }}
            onClick={() => setViewDeleted(!viewDeleted)}
          >
            {viewDeleted ? '삭제된 리스트 닫기' : `삭제된 리스트 보기 (${deletedTodos.length}개)`}
          </button>
          
          {viewDeleted && (
            <div className="todo-list glass-container" style={{ padding: '8px', marginTop: '12px' }}>
              {deletedTodos.map(todo => (
                <div key={todo.id} className="todo-item compact completed" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0px', opacity: 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="todo-text">{todo.text}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className={`assignee ${todo.assignee}`}>
                        {todo.assignee === 'both' ? '쀼' : todo.assignee === 'me' ? '가은' : '경민'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="delete-btn" style={{ color: '#4ecdc4' }} onClick={() => restoreTodo(todo.id)} title="복구하기">
                        <RotateCcw size={16} />
                      </button>
                      <button className="delete-btn" style={{ color: '#ff6b6b' }} onClick={() => hardDeleteTodo(todo.id)} title="영구 삭제">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAB Add Button */}
      <button className="fab" onClick={openAddModal}>
        <Heart fill="#ffb6c1" color="#ffb6c1" size={24} />
      </button>

      {/* Modal */}
      <div className={`modal-overlay ${isModalOpen ? 'open' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">{editingId ? '할 일 수정' : '아자아자!'}</h2>
            <button className="close-btn" onClick={() => setIsModalOpen(false)}>
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={saveTodo}>
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
              <label>시간 설정</label>
              <input
                type="time"
                className="input-text"
                step="300"
                value={dueDate}
                onChange={handleDateChange}
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
                  쀼
                </button>
                <button
                  type="button"
                  className={`segment-btn ${assignee === 'me' ? 'active' : ''}`}
                  onClick={() => setAssignee('me')}
                >
                  가은
                </button>
                <button
                  type="button"
                  className={`segment-btn ${assignee === 'you' ? 'active' : ''}`}
                  onClick={() => setAssignee('you')}
                >
                  경민
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {editingId ? '수정' : '추가'}
              <Heart fill="#ffb6c1" color="#ffb6c1" size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
