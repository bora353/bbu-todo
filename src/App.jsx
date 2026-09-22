import { useEffect, useState, useRef } from 'react'
import { Plus, Check, Heart, Trash2, Calendar, X, Bell, RotateCcw, ThumbsUp, Tag, Repeat } from 'lucide-react'
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

const CATEGORY_EMOJIS = ['👶', '📅', '🛒', '🍽️', '❤️']

export default function App() {
  const [todos, setTodos] = useState([])
  const [postItMessage, setPostItMessage] = useState('')
  const [isEditingPostIt, setIsEditingPostIt] = useState(false)
  const postItInputRef = useRef(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTodo, setNewTodo] = useState('')
  const [assignee, setAssignee] = useState('both')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedHour, setSelectedHour] = useState('6')
  const [category, setCategory] = useState('')
  const [recurrence, setRecurrence] = useState('none')
  
  const [viewCompleted, setViewCompleted] = useState(false)
  const [viewDeleted, setViewDeleted] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [toast, setToast] = useState(null)
  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }
  
  // Profile
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('currentUser') || null)

  useEffect(() => {
    fetchTodos()
    fetchPostIt()

    const todoSub = supabase
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
      
    const postItSub = supabase
      .channel('post_it')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_it' }, payload => {
        setPostItMessage(payload.new.message)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(todoSub)
      supabase.removeChannel(postItSub)
    }
  }, [])

  const fetchTodos = async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) setTodos(data)
  }

  const fetchPostIt = async () => {
    const { data } = await supabase.from('post_it').select('message').eq('id', 1).single();
    if (data) setPostItMessage(data.message);
  }

  const savePostIt = async (e) => {
    if (e.key === 'Enter' || e.type === 'blur') {
      setIsEditingPostIt(false)
      await supabase.from('post_it').update({ message: postItMessage }).eq('id', 1)
    }
  }

  const getInitialDate = () => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
  }

  const openAddModal = () => {
    setEditingId(null)
    setNewTodo('')
    setAssignee('both')
    setCategory('')
    setRecurrence('none')
    setSelectedDate(getInitialDate())
    setSelectedHour('6')
    setIsModalOpen(true)
  }

  const openEditModal = (todo) => {
    setEditingId(todo.id)
    setNewTodo(todo.text)
    setAssignee(todo.assignee)
    setCategory(todo.category || '')
    setRecurrence(todo.recurrence || 'none')
    
    if (todo.due_date) {
      const d = new Date(todo.due_date);
      const tzOffset = d.getTimezoneOffset() * 60000;
      setSelectedDate(new Date(d.getTime() - tzOffset).toISOString().slice(0, 10));
      setSelectedHour(d.getHours().toString());
    } else {
      setSelectedDate('');
      setSelectedHour('6');
    }
    setIsModalOpen(true)
  }

  const saveTodo = async (e) => {
    e.preventDefault()
    if (!newTodo.trim()) return

    let isoDueDate = null;
    if (selectedDate) {
      const [y, m, day] = selectedDate.split('-').map(Number);
      const d = new Date();
      d.setFullYear(y, m - 1, day);
      d.setHours(Number(selectedHour), 0, 0, 0);
      isoDueDate = d.toISOString();
    }

    const todoData = { 
      text: newTodo, 
      assignee,
      category,
      recurrence,
      due_date: isoDueDate
    }

    if (editingId) {
      setTodos(prev => prev.map(t => t.id === editingId ? { ...t, ...todoData } : t))
      await supabase.from('todos').update(todoData).eq('id', editingId)
    } else {
      todoData.completed = false
      todoData.is_deleted = false
      await supabase.from('todos').insert([todoData])
    }

    setIsModalOpen(false)
  }

  const toggleTodo = async (todo) => {
    const newStatus = !todo.completed
    const completedAt = newStatus ? new Date().toISOString() : null;
    
    if (newStatus) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff6b6b', '#4ecdc4', '#ffe66d']
      })
    }

    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: newStatus, completed_at: completedAt } : t))
    await supabase.from('todos').update({ completed: newStatus, completed_at: completedAt }).eq('id', todo.id)

    if (newStatus && todo.recurrence && todo.recurrence !== 'none') {
      const nextDate = new Date(todo.due_date || new Date());
      if (todo.recurrence === 'daily') nextDate.setDate(nextDate.getDate() + 1);
      if (todo.recurrence === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      
      const newTodo = {
        text: todo.text,
        assignee: todo.assignee,
        category: todo.category,
        recurrence: todo.recurrence,
        due_date: nextDate.toISOString(),
        completed: false,
        is_deleted: false
      };
      await supabase.from('todos').insert([newTodo]);
    }
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

  const enableNotifications = async () => {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      showToast('이 브라우저에서는 알림을 지원하지 않습니다.\n아이폰인 경우 반드시 "홈 화면에 추가"를 통해 앱을 설치하고 열어주세요!');
      return;
    }
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
          user_name: currentUser,
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
            auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
          }
        }, { onConflict: 'endpoint' });
        
        showToast('알림 설정이 정상적으로 완료되었습니다! 🎉\n이제 서로 부탁하기를 할 수 있어요!');
      } catch (err) {
        console.error("Failed to subscribe to push", err);
        showToast('알림 설정 중 오류가 발생했습니다.');
      }
    } else {
      showToast('알림 권한을 허용해주셔야 푸시를 받을 수 있습니다.');
    }
  }

  const handlePoke = async (taskText, isCompliment = false) => {
    const target = currentUser === '가은' ? '경민' : '가은';
    try {
      const res = await fetch('/api/poke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: currentUser, target, taskText, isCompliment })
      });
      if (res.ok) {
        showToast(isCompliment ? `${target}님을 칭찬했어요! 😍` : `${target}님에게 부탁 알림을 보냈어요! 🙏`);
      } else if (res.status === 404) {
        showToast(`${target}님이 아직 앱에 접속하지 않아 알림을 받을 수 없습니다.`);
      } else {
        showToast('알림 전송에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
      showToast('에러가 발생했습니다.');
    }
  }

  const isOtherTask = (assignee) => {
    if (currentUser === '가은' && assignee === 'you') return true;
    if (currentUser === '경민' && assignee === 'me') return true;
    return false;
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
    if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  const completedTodos = activeTodos.filter(t => t.completed)
  const deletedTodos = todos.filter(t => t.is_deleted)
  
  const dday = getDDay()

  return (
    <div className="app-wrapper" style={{ paddingBottom: '100px' }}>
      <header className="header" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="d-day-badge">{dday}</div>
        <button 
          className="delete-btn" 
          style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', padding: '8px', color: '#ff6b6b' }}
          onClick={enableNotifications} 
          title="알림 권한 다시 켜기"
        >
          <Bell size={18} />
        </button>
      </header>

      {/* Post-it Note */}
      <div className="post-it" onClick={() => { setIsEditingPostIt(true); setTimeout(() => postItInputRef.current?.focus(), 100); }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '30px' }}>
          {isEditingPostIt ? (
            <input
              ref={postItInputRef}
              value={postItMessage}
              onChange={e => setPostItMessage(e.target.value)}
              onBlur={savePostIt}
              onKeyDown={savePostIt}
              className="post-it-input"
              placeholder="오늘의 한 줄 편지를 남겨보세요❤️"
            />
          ) : (
            <span>{postItMessage || "오늘의 한 줄 편지를 남겨보세요❤️"}</span>
          )}
        </div>
      </div>

      {/* Uncompleted List */}
      <div className="todo-list glass-container" style={{ padding: '8px', flex: 'none' }}>
        {uncompletedTodos.length === 0 ? (
          <div className="empty-state">
            <Heart color="var(--glass-border)" />
            <p>모든 할 일을 마쳤어요!<br/>여유를 즐기세요 🎉</p>
          </div>
        ) : (
          uncompletedTodos.map(todo => {
            const dimmed = isOtherTask(todo.assignee);
            return (
              <div key={todo.id} className={`todo-item compact ${dimmed ? 'dimmed-task' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    className={`checkbox`}
                    onClick={() => toggleTodo(todo)}
                  >
                    <Check size={14} strokeWidth={3} />
                  </button>
                  <span 
                    className="todo-text" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => openEditModal(todo)}
                  >
                    {todo.category && <span style={{ marginRight: '6px' }}>{todo.category}</span>}
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
                        <Calendar size={10} />
                        {format(new Date(todo.due_date), 'MM/dd a h시', { locale: ko })}
                      </span>
                    )}
                    {todo.recurrence && todo.recurrence !== 'none' && (
                      <span className="todo-date" style={{ color: '#4ecdc4', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Repeat size={10} />
                        {todo.recurrence === 'daily' ? '매일' : '매주'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="delete-btn" onClick={() => handlePoke(todo.text)} title="상대방에게 부탁하기">
                      <Bell size={16} />
                    </button>
                    <button className="delete-btn" onClick={() => softDeleteTodo(todo.id)} title="삭제">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Completed List Toggle */}
      {completedTodos.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <button 
            className="toggle-completed-btn"
            onClick={() => setViewCompleted(!viewCompleted)}
          >
            {viewCompleted ? '완료됨 닫기' : `완료됨 (${completedTodos.length})`}
          </button>
          
          {viewCompleted && (
            <div className="todo-list glass-container" style={{ padding: '8px', marginTop: '12px' }}>
              {completedTodos.map(todo => (
                <div key={todo.id} className="todo-item compact completed" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      className="checkbox checked"
                      onClick={() => toggleTodo(todo)}
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>
                    <span 
                      className="todo-text"
                      style={{ cursor: 'pointer' }}
                      onClick={() => openEditModal(todo)}
                    >
                      {todo.category && <span style={{ marginRight: '6px' }}>{todo.category}</span>}
                      {todo.text}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0px', paddingLeft: '36px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className={`assignee ${todo.assignee}`}>
                        {todo.assignee === 'both' ? '쀼' : todo.assignee === 'me' ? '가은' : '경민'}
                      </span>
                      {todo.completed_at && (
                        <span className="todo-date">
                          <Check size={10} />
                          {format(new Date(todo.completed_at), 'MM/dd 완료', { locale: ko })}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="delete-btn" style={{ color: '#ff6b6b', opacity: 1 }} onClick={() => handlePoke(todo.text, true)} title="칭찬하기">
                        <ThumbsUp size={16} />
                      </button>
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
            {viewDeleted ? '삭제됨 닫기' : `삭제됨 (${deletedTodos.length})`}
          </button>
          
          {viewDeleted && (
            <div className="todo-list glass-container" style={{ padding: '8px', marginTop: '12px' }}>
              {deletedTodos.map(todo => (
                <div key={todo.id} className="todo-item compact completed" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0px', opacity: 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="todo-text">
                      {todo.category && <span style={{ marginRight: '6px' }}>{todo.category}</span>}
                      {todo.text}
                    </span>
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
              <label><Tag size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>카테고리 (선택)</label>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                <button
                  type="button"
                  className={`segment-btn ${category === '' ? 'active' : ''}`}
                  onClick={() => setCategory('')}
                  style={{ minWidth: '40px', padding: '8px 4px' }}
                >
                  없음
                </button>
                {CATEGORY_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    className={`segment-btn ${category === emoji ? 'active' : ''}`}
                    onClick={() => setCategory(emoji)}
                    style={{ minWidth: '40px', padding: '8px 4px', fontSize: '18px' }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label><Repeat size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>반복 설정</label>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segment-btn ${recurrence === 'none' ? 'active' : ''}`}
                  onClick={() => setRecurrence('none')}
                >
                  반복 안함
                </button>
                <button
                  type="button"
                  className={`segment-btn ${recurrence === 'daily' ? 'active' : ''}`}
                  onClick={() => setRecurrence('daily')}
                >
                  매일 반복
                </button>
                <button
                  type="button"
                  className={`segment-btn ${recurrence === 'weekly' ? 'active' : ''}`}
                  onClick={() => setRecurrence('weekly')}
                >
                  매주 반복
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>기한 설정 (선택)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="date" 
                  className="input-text" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ flex: 2 }}
                />
                <select 
                  className="input-text" 
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(e.target.value)}
                  disabled={!selectedDate}
                  style={{ flex: 1, padding: '0 8px', textAlign: 'center' }}
                >
                  {[...Array(24)].map((_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '오전 12시' : i < 12 ? `오전 ${i}시` : i === 12 ? '오후 12시' : `오후 ${i - 12}시`}
                    </option>
                  ))}
                </select>
              </div>
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
      {/* Toast Notification */}
      {toast && (
        <div className="toast-message">
          {toast}
        </div>
      )}

    </div>
  )
}
