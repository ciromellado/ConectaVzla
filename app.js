// ==========================================
// CONECTAVZLA - INTEGRACIÓN CON SUPABASE
// ==========================================

// 🔑 CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = 'https://uftrifkqbmxetluwupua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmdHJpZmtxYm14ZXRsdXd1cHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwODA5MDgsImV4cCI6MjEwMTY1NjkwOH0.P-xk8kidvZc69y2k77MOQd9ZdnJyKJq-t2AhK1pec8o';

// Inicializar cliente Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// CONSTANTES Y ESTADO GLOBAL
// ==========================================
const MAX_MESSAGES = 10;
const MAX_IMAGES_PER_MESSAGE = 2;

// Elementos del DOM
const loginView = document.getElementById('login-view');
const chatListView = document.getElementById('chat-list-view');
const chatRoomView = document.getElementById('chat-room-view');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const activeName = document.getElementById('active-name');
const contactsContainer = document.getElementById('contacts-container');
const usernameInput = document.getElementById('username-input');
const imageInput = document.getElementById('image-input');

let currentContact = null;
let currentUser = null;
let currentUserId = null;
let currentChatId = null;
let messageSubscription = null;

// Variables para grabación multimedia
let mediaRecorder;
let mediaChunks = [];

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ==========================================
// AUTENTICACIÓN Y USUARIO
// ==========================================
async function registrarUsuario() {
    const nombreUsuario = usernameInput.value.trim();
    
    if (nombreUsuario === "") {
        alert("Por favor, ingresa un nombre válido.");
        return;
    }

    try {
        // Verificar si el usuario ya existe
        const { data: existingUser, error: selectError } = await supabaseClient
            .from('users')
            .select('id, username')
            .eq('username', nombreUsuario)
            .maybeSingle();

        if (selectError && selectError.code !== 'PGRST116') {
            throw selectError;
        }

        if (existingUser) {
            // Usuario ya existe
            currentUser = existingUser.username;
            currentUserId = existingUser.id;
        } else {
            // Crear nuevo usuario
            const { data: newUser, error: insertError } = await supabaseClient
                .from('users')
                .insert([{ username: nombreUsuario }])
                .select()
                .single();

            if (insertError) throw insertError;
            
            currentUser = newUser.username;
            currentUserId = newUser.id;
        }

        // Guardar en localStorage
        localStorage.setItem('usuarioActual', currentUser);
        localStorage.setItem('usuarioId', currentUserId);

        // Cambiar vista
        loginView.classList.remove('active');
        chatListView.classList.add('active');
        
        await cargarContactos();
        
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        if (error.code === '23505') {
            alert('Este nombre de usuario ya está en uso. Intenta con otro.');
        } else {
            alert('Error al registrar usuario: ' + error.message);
        }
    }
}

async function inicializarUsuarioActual() {
    const usuarioGuardado = localStorage.getItem('usuarioActual');
    const usuarioIdGuardado = localStorage.getItem('usuarioId');
    
    if (usuarioGuardado && usuarioIdGuardado) {
        currentUser = usuarioGuardado;
        currentUserId = usuarioIdGuardado;
        return true;
    }
    return false;
}

// ==========================================
// GESTIÓN DE CONTACTOS (CHATS)
// ==========================================
async function cargarContactos() {
    try {
        const { data: chats, error } = await supabaseClient
            .from('chats')
            .select(`
                *,
                messages (
                    content,
                    message_type,
                    created_at
                )
            `)
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const contactsList = chats.map(chat => {
            // ✅ CORRECCIÓN: Ordenar mensajes por fecha descendente
            let lastMessage = '¡Nuevo chat iniciado!';
            let time = formatTime(chat.created_at);
            
            if (chat.messages && chat.messages.length > 0) {
                // Ordenar mensajes del más nuevo al más antiguo
                const sortedMessages = [...chat.messages].sort((a, b) => 
                    new Date(b.created_at) - new Date(a.created_at)
                );
                
                const lastMsg = sortedMessages[0];
                
                if (lastMsg.message_type === 'text') {
                    lastMessage = lastMsg.content;
                } else if (lastMsg.message_type === 'audio') {
                    lastMessage = '🎤 Nota de voz';
                } else if (lastMsg.message_type === 'video') {
                    lastMessage = '📹 Videomensaje';
                } else if (lastMsg.message_type === 'image') {
                    lastMessage = '📷 Imagen';
                }
                time = formatTime(lastMsg.created_at);
            }

            return {
                id: chat.id,
                name: chat.contact_name,
                lastMessage: lastMessage,
                time: time,
                avatar: chat.contact_avatar || 'img/avatar.webp'
            };
        });

        renderContacts(contactsList);
        
    } catch (error) {
        console.error('Error al cargar contactos:', error);
    }
}

function renderContacts(contactsList) {
    contactsContainer.innerHTML = '';

    contactsList.forEach(contact => {
        const contactDiv = document.createElement('div');
        contactDiv.classList.add('contact-item');
        contactDiv.dataset.contactName = contact.name;
        contactDiv.dataset.chatId = contact.id;

        contactDiv.innerHTML = `
            <img src="${contact.avatar}" 
                 alt="Avatar de ${escapeHTML(contact.name)}" 
                 class="avatar" 
                 onerror="this.src='img/avatar.webp'">
            <div class="contact-info">
                <div class="contact-row">
                    <span class="contact-name">${escapeHTML(contact.name)}</span>
                    <span class="message-time">${escapeHTML(contact.time)}</span>
                </div>
                <div class="contact-row">
                    <p class="last-message">${escapeHTML(contact.lastMessage)}</p>
                </div>
            </div>
            <button class="btn-delete-contact" data-action="delete" title="Borrar chat y contacto">🗑️</button>
        `;
        contactsContainer.appendChild(contactDiv);
    });
}

async function crearNuevoChat() {
    const newContactName = prompt("Ingresa el nombre del nuevo contacto:");
    
    if (newContactName && newContactName.trim() !== "") {
        const nameFormatted = newContactName.trim();
        
        try {
            const { data: newChat, error } = await supabaseClient
                .from('chats')
                .insert([{
                    user_id: currentUserId,
                    contact_name: nameFormatted,
                    contact_avatar: 'img/avatar.webp'
                }])
                .select()
                .single();

            if (error) throw error;

            await cargarContactos();
            await abrirChat(nameFormatted, newChat.id);
            
        } catch (error) {
            if (error.code === '23505') {
                alert('Ya tienes un chat con este contacto.');
            } else {
                console.error('Error al crear chat:', error);
                alert('Error al crear el chat.');
            }
        }
    }
}

// ==========================================
// GESTIÓN DE MENSAJES
// ==========================================
async function abrirChat(contactName, chatId) {
    currentContact = contactName;
    activeName.textContent = contactName;
    
    // Obtener el chat_id si no se pasó
    if (!chatId) {
        const { data: chat, error } = await supabaseClient
            .from('chats')
            .select('id')
            .eq('user_id', currentUserId)
            .eq('contact_name', contactName)
            .maybeSingle();
        
        if (error || !chat) {
            console.error('Error al obtener chat:', error);
            return;
        }
        
        chatId = chat.id;
    }
    
    currentChatId = chatId;
    
    chatListView.classList.remove('active');
    chatRoomView.classList.add('active');
    
    await cargarMensajes();
    suscribirseAMensajes();
}

function cerrarChat() {
    if (messageSubscription) {
        messageSubscription.unsubscribe();
        messageSubscription = null;
    }
    chatRoomView.classList.remove('active');
    chatListView.classList.add('active');
    currentContact = null;
    currentChatId = null;
}

async function cargarMensajes() {
    if (!currentChatId) return;
    
    try {
        const { data: messages, error } = await supabaseClient
            .from('messages')
            .select('*')
            .eq('chat_id', currentChatId)
            .order('created_at', { ascending: true })
            .limit(MAX_MESSAGES);

        if (error) throw error;
        
        renderMessages(messages || []);
        
    } catch (error) {
        console.error('Error al cargar mensajes:', error);
    }
}

function renderMessages(messages) {
    messagesContainer.innerHTML = '';
    
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        const isSent = msg.sender_name === currentUser;
        messageDiv.classList.add('message', isSent ? 'sent' : 'received');
        messageDiv.dataset.msgId = msg.id;
        
        let contenidoMensaje = '';
        
        if (msg.message_type === 'text') {
            contenidoMensaje = `<p>${escapeHTML(msg.content)}</p>`;
        } else if (msg.message_type === 'audio' && msg.file_urls && msg.file_urls.length > 0) {
            contenidoMensaje = `<audio controls src="${msg.file_urls[0]}"></audio>`;
        } else if (msg.message_type === 'video' && msg.file_urls && msg.file_urls.length > 0) {
            contenidoMensaje = `<video controls src="${msg.file_urls[0]}" style="max-width: 100%;"></video>`;
        } else if (msg.message_type === 'image' && msg.file_urls && msg.file_urls.length > 0) {
            const imagesHtml = msg.file_urls.map(url => 
                `<img src="${url}" alt="Imagen" style="max-width: 100%; margin: 2px 0;">`
            ).join('');
            contenidoMensaje = imagesHtml;
        }

        messageDiv.innerHTML = `
            <div class="msg-signature" style="font-size: 0.75rem; font-weight: bold; color: #0288D1; margin-bottom: 2px;">
                ${escapeHTML(msg.sender_name)}
            </div>
            ${contenidoMensaje}
            <div class="msg-footer">
                <span class="msg-time">${formatTime(msg.created_at)}</span>
                <button class="btn-delete" data-action="delete-msg" title="Borrar mensaje">×</button>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function suscribirseAMensajes() {
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }
    
    messageSubscription = supabaseClient
        .channel('mensajes-' + currentChatId)
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'messages',
                filter: `chat_id=eq.${currentChatId}`
            }, 
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    cargarMensajes();
                    // Reproducir sonido de notificación si no es el usuario actual
                    if (payload.new.sender_name !== currentUser) {
                        const notifSound = document.getElementById('notification-sound');
                        if (notifSound) {
                            notifSound.play().catch(() => {});
                        }
                    }
                } else if (payload.eventType === 'DELETE') {
                    cargarMensajes();
                }
            }
        )
        .subscribe();
}

// ==========================================
// ENVIAR MENSAJES
// ==========================================
async function enviarMensajeTexto() {
    const text = messageInput.value.trim();
    if (text === '' || !currentChatId) return;

    try {
        const { error } = await supabaseClient
            .from('messages')
            .insert([{
                chat_id: currentChatId,
                sender_name: currentUser,
                content: text,
                message_type: 'text',
                file_urls: []
            }]);

        if (error) throw error;
        
        messageInput.value = '';
        
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        alert('Error