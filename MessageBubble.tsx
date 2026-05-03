import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Chat, Message, User } from '../types';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import EmptyChat from './EmptyChat';

export default function MainView() {
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const { token } = useAuth();
  const { socket } = useSocket();

  useEffect(() => {
    fetchChats();
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    socket.on('new_message', (message: Message) => {
      // Update chats list (move chat to top, update last message)
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(c => c.id === message.chat_id);
        if (chatIndex === -1) {
          // If chat not in list, fetch all chats again or handle new chat
          fetchChats();
          return prevChats;
        }
        
        const updatedChat = {
          ...prevChats[chatIndex],
          last_message: message.content,
          last_message_time: message.created_at
        };
        
        const newChats = [...prevChats];
        newChats.splice(chatIndex, 1);
        return [updatedChat, ...newChats];
      });
    });

    socket.on('user_status_change', ({ userId, isOnline, lastSeen }: any) => {
      setChats(prevChats => prevChats.map(chat => ({
        ...chat,
        participants: chat.participants.map(p => 
          p.id === userId ? { ...p, is_online: isOnline, last_seen: lastSeen } : p
        )
      })));
      
      if (activeChat) {
        setActiveChat(prev => {
          if (!prev) return null;
          return {
            ...prev,
            participants: prev.participants.map(p => 
              p.id === userId ? { ...p, is_online: isOnline, last_seen: lastSeen } : p
            )
          };
        });
      }
    });

    return () => {
      socket.off('new_message');
      socket.off('user_status_change');
    };
  }, [socket, activeChat]);

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/chats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setChats(data);
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  const startPrivateChat = async (user: User) => {
    try {
      const res = await fetch('/api/chats/private', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: user.id })
      });
      const data = await res.json();
      
      // Fetch fresh list to see new chat
      await fetchChats();
      
      // Find the chat in the updated list or fetch it specifically
      const res2 = await fetch('/api/chats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const freshChats = await res2.json();
      const chat = freshChats.find((c: Chat) => c.id === data.chatId);
      if (chat) setActiveChat(chat);
    } catch (err) {
      console.error('Error starting chat:', err);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-950">
      <Sidebar 
        chats={chats} 
        activeChatId={activeChat?.id} 
        onChatSelect={setActiveChat} 
        onUserSelect={startPrivateChat}
      />
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {activeChat ? (
          <ChatWindow 
            chat={activeChat} 
            key={`chat-${activeChat.id}`} 
          />
        ) : (
          <EmptyChat />
        )}
      </main>
    </div>
  );
}
