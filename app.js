// ==========================================
// CONECTAVZLA - SUPABASE CON AUTENTICACIÓN
// ==========================================

const SUPABASE_URL = 'https://uftrifkqbmxetluwupua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmdHJpZmtxYm14ZXRsdXd1cHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwODA5MDgsImV4cCI6MjEwMTY1NjkwOH0.P-xk8kidvZc69y2k77MOQd9ZdnJyKJq-t2AhK1pec8o';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EMAIL_DOMAIN = '@conectavzla.app';
const MAX_MESSAGES = 10;
const MAX_IMAGES_PER_MESSAGE = 2;

const loginView = document.getElementById('login-view');
const chatListView = document.getElementById('chat-list-view');
const chatRoomView = document.getElementById('chat-room-view');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const activeName = document.getElementById('active-name');
const contactsContainer = document.getElementById('contacts-container');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');
const imageInput = document.getElementById('image-input');

let currentContact = null;
let currentUser = null;
let currentUserId = null;
let currentChatId = null;
let messageSubscription = null;

let mediaRecorder;
let mediaChunks = [];

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

function mostrarErrorLogin(mensaje) {
    if (loginError) loginError.textContent = mensaje;
    if (mensaje !== '') console.error(mensaje);
}

// ==========================================
// AUTENTICACIÓN (USUARIO + CONTRASEÑA)
// ==========================================
function emailDesdeUsuario(username) {
    return username.toLowerCase() + EMAIL_DOMAIN;
}

async function iniciarSesion() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (username === '' || password === '') {
        mostrarErrorLogin('Escribe tu usuario y tu contraseña.');
        return;
    }

    try {
        const result = await supabaseClient.auth.signInWithPassword({
            email: emailDesdeUsuario(username),
            password: password
        });

        if (result.error) {
            mostrarErrorLogin('Usuario o contraseña incorrectos.');
            return;
        }

        await prepararSesion(result.data.user);
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        mostrarErrorLogin('Error de conexión. Intenta de nuevo.');
    }
}

async function crearCuenta() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (username.length < 3) {
        mostrarErrorLogin('El usuario debe tener al menos 3 caracteres.');
        return;
    }
    if (password.length < 6) {
        mostrarErrorLogin('La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    try {
        const result = await supabaseClient.auth.signUp({
            email: emailDesdeUsuario(username),
            password: password
        });

        if (result.error) {
            const msg = result.error.message.toLowerCase();
            if (msg.indexOf('already') !== -1 || msg.indexOf('exist') !== -1) {
                mostrarErrorLogin('Ese usuario ya existe. Usa el botón Entrar.');
            } else {
                mostrarErrorLogin(result.error.message);
            }
            return;
        }

        if (!result.data.session) {
            mostrarErrorLogin('Cuenta creada. Confirma tu correo para entrar.');
            return;
        }

        const saveResult = await supabaseClient
            .from('users')
            .upsert({ id: result.data.user.id, username: username });

        if (saveResult.error) {
            console.error('Error guardando usuario:', saveResult.error);
        }

        await prepararSesion(result.data.user);
    } catch (error) {
        console.error('Error al crear cuenta:', error);
        mostrarErrorLogin('Error de conexión. Intenta de nuevo.');
    }
}

async function prepararSesion(authUser) {
    currentUserId = authUser.id;

    const result = await supabaseClient
        .from('users')
        .select('username')
        .eq('id', authUser.id)
        .maybeSingle();

    if (result.data) {
        currentUser = result.data.username;
    } else {
        currentUser = authUser.email.split('@')[0];
    }

    mostrarErrorLogin('');
    loginView.classList.remove('active');
    chatListView.classList.add('active');
    await cargarContactos();
}

async function cerrarSesion() {
    if (messageSubscription) {
        messageSubscription.unsubscribe();
        messageSubscription = null;
    }
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentUserId = null;
    currentContact = null;
    currentChatId = null;
    chatRoomView.classList.remove('active');
    chatListView.classList.remove('active');
    loginView.classList.add('active');
    passwordInput.value = '';
}

// ==========================================
// GESTIÓN DE CONTACTOS (CHATS)
// ==========================================
async function cargarContactos() {
    try {
        const result = await supabaseClient
            .from('chats')
            .select('*, messages(content, message_type, created_at)')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false });

        if (result.error) throw result.error;

        const chats = result.data;
        const contactsList = [];

        chats.forEach(function(chat) {
            let lastMessage = '¡Nuevo chat iniciado!';
            let time = formatTime(chat.created_at);
            
            if (chat.messages && chat.messages.length > 0) {
                const sortedMessages = chat.messages.slice().sort(function(a, b) {
                    return new Date(b.created_at) - new Date(a.created_at);
                });
                
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

            contactsList.push({
                id: chat.id,
                name: chat.contact_name,
                lastMessage: lastMessage,
                time: time,
                avatar: chat.contact_avatar || 'img/avatar.webp'
            });
        });

        renderContacts(contactsList);
        
    } catch (error) {
        console.error('Error al cargar contactos:', error);
    }
}

function renderContacts(contactsList) {
    contactsContainer.innerHTML = '';

    if (contactsList.length === 0) {
        contactsContainer.innerHTML = '<p style="text-align: center; padding: 20px; opacity: 0.7;">No tienes chats aún. ¡Crea uno con el botón ➕!</p>';
        return;
    }

    contactsList.forEach(function(contact) {
        const contactDiv = document.createElement('div');
        contactDiv.classList.add('contact-item');
        contactDiv.dataset.contactName = contact.name;
        contactDiv.dataset.chatId = contact.id;

        const imgTag = '<img src="' + contact.avatar + '" alt="Avatar de ' + escapeHTML(contact.name) + '" class="avatar" onerror="this.src=\'img/avatar.webp\'">';
        const nameSpan = '<span class="contact-name">' + escapeHTML(contact.name) + '</span>';
        const timeSpan = '<span class="message-time">' + escapeHTML(contact.time) + '</span>';
        const lastMsg = '<p class="last-message">' + escapeHTML(contact.lastMessage) + '</p>';
        const deleteBtn = '<button class="btn-delete-contact" data-action="delete" title="Borrar chat y contacto">🗑️</button>';
        
        const html = '<div class="contact-info">' +
            '<div class="contact-row">' + nameSpan + timeSpan + '</div>' +
            '<div class="contact-row">' + lastMsg + '</div>' +
            '</div>';
        
        contactDiv.innerHTML = imgTag + html + deleteBtn;
        contactsContainer.appendChild(contactDiv);
    });
}

async function crearNuevoChat() {
    const newContactName = prompt('Ingresa el nombre del nuevo contacto:');
    
    if (newContactName && newContactName.trim() !== '') {
        const nameFormatted = newContactName.trim();
        
        try {
            const result = await supabaseClient
                .from('chats')
                .insert([{
                    user_id: currentUserId,
                    contact_name: nameFormatted,
                    contact_avatar: 'img/avatar.webp'
                }])
                .select()
                .single();

            if (result.error) throw result.error;

            await cargarContactos();
            await abrirChat(nameFormatted, result.data.id);
            
        } catch (error) {
            console.error('Error al crear chat:', error);
        }
    }
}

// ==========================================
// GESTIÓN DE MENSAJES
// ==========================================
async function abrirChat(contactName, chatId) {
    currentContact = contactName;
    activeName.textContent = contactName;
    
    if (!chatId) {
        const result = await supabaseClient
            .from('chats')
            .select('id')
            .eq('user_id', currentUserId)
            .eq('contact_name', contactName)
            .maybeSingle();
        
        if (result.error || !result.data) {
            console.error('Error al obtener chat:', result.error);
            return;
        }
        
        chatId = result.data.id;
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
        const result = await supabaseClient
            .from('messages')
            .select('*')
            .eq('chat_id', currentChatId)
            .order('created_at', { ascending: true })
            .limit(MAX_MESSAGES);

        if (result.error) throw result.error;
        
        renderMessages(result.data || []);
        
    } catch (error) {
        console.error('Error al cargar mensajes:', error);
    }
}

function renderMessages(messages) {
    messagesContainer.innerHTML = '';
    
    messages.forEach(function(msg) {
        const messageDiv = document.createElement('div');
        const isSent = msg.sender_name === currentUser;
        messageDiv.classList.add('message');
        messageDiv.classList.add(isSent ? 'sent' : 'received');
        messageDiv.dataset.msgId = msg.id;
        
        let contenidoMensaje = '';
        
        if (msg.message_type === 'text') {
            contenidoMensaje = '<p>' + escapeHTML(msg.content) + '</p>';
        } else if (msg.message_type === 'audio' && msg.file_urls && msg.file_urls.length > 0) {
            contenidoMensaje = '<audio controls src="' + msg.file_urls[0] + '"></audio>';
        } else if (msg.message_type === 'video' && msg.file_urls && msg.file_urls.length > 0) {
            contenidoMensaje = '<video controls src="' + msg.file_urls[0] + '" style="max-width: 100%;"></video>';
        } else if (msg.message_type === 'image' && msg.file_urls && msg.file_urls.length > 0) {
            let imagesHtml = '';
            msg.file_urls.forEach(function(url) {
                imagesHtml += '<img src="' + url + '" alt="Imagen" style="max-width: 100%; margin: 2px 0;">';
            });
            contenidoMensaje = imagesHtml;
        }

        const firma = '<div class="msg-signature" style="font-size: 0.75rem; font-weight: bold; color: #0288D1; margin-bottom: 2px;">' + escapeHTML(msg.sender_name) + '</div>';
        const footer = '<div class="msg-footer"><span class="msg-time">' + formatTime(msg.created_at) + '</span><button class="btn-delete" data-action="delete-msg" title="Borrar mensaje">×</button></div>';
        
        messageDiv.innerHTML = firma + contenidoMensaje + footer;
        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function suscribirseAMensajes() {
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }
    
    const channelName = 'mensajes-' + currentChatId;
    const filterStr = 'chat_id=eq.' + currentChatId;
    
    messageSubscription = supabaseClient
        .channel(channelName)
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'messages',
                filter: filterStr
            }, 
            function(payload) {
                if (payload.eventType === 'INSERT') {
                    cargarMensajes();
                    if (payload.new.sender_name !== currentUser) {
                        const notifSound = document.getElementById('notification-sound');
                        if (notifSound) {
                            notifSound.play().catch(function() {});
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
        const result = await supabaseClient
            .from('messages')
            .insert([{
                chat_id: currentChatId,
                sender_name: currentUser,
                content: text,
                message_type: 'text',
                file_urls: []
            }]);

        if (result.error) throw result.error;
        
        messageInput.value = '';
        
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
    }
}

async function enviarMensajeMultimedia(fileUrls, messageType) {
    if (!currentChatId) return;

    let contentDesc = '';
    if (messageType === 'audio') contentDesc = 'Nota de voz';
    else if (messageType === 'video') contentDesc = 'Videomensaje';
    else contentDesc = 'Imagen';

    try {
        const result = await supabaseClient
            .from('messages')
            .insert([{
                chat_id: currentChatId,
                sender_name: currentUser,
                content: contentDesc,
                message_type: messageType,
                file_urls: fileUrls
            }]);

        if (result.error) throw result.error;
        
    } catch (error) {
        console.error('Error al enviar multimedia:', error);
    }
}

// ==========================================
// SUBIR ARCHIVOS A SUPABASE STORAGE
// ==========================================
async function subirArchivo(file, bucket) {
    const fileNameParts = file.name.split('.');
    const fileExt = fileNameParts.length > 1 ? fileNameParts.pop() : 'bin';
    const fileName = Date.now() + '-' + Math.random().toString(36).substring(7) + '.' + fileExt;
    const filePath = currentUserId + '/' + fileName;

    const uploadResult = await supabaseClient.storage
        .from(bucket)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadResult.error) throw uploadResult.error;

    const urlResult = supabaseClient.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return urlResult.data.publicUrl;
}

async function subirImagenes(files) {
    if (files.length > MAX_IMAGES_PER_MESSAGE) {
        alert('Solo puedes subir máximo ' + MAX_IMAGES_PER_MESSAGE + ' imágenes por mensaje.');
        return;
    }

    try {
        const urls = [];
        for (let i = 0; i < files.length; i++) {
            const url = await subirArchivo(files[i], 'images');
            urls.push(url);
        }
        await enviarMensajeMultimedia(urls, 'image');
    } catch (error) {
        console.error('Error al subir imágenes:', error);
    }
}

async function subirAudio(blob) {
    try {
        const file = new File([blob], 'audio-' + Date.now() + '.webm', { type: 'audio/webm' });
        const url = await subirArchivo(file, 'audio');
        await enviarMensajeMultimedia([url], 'audio');
    } catch (error) {
        console.error('Error al subir audio:', error);
    }
}

async function subirVideo(blob) {
    try {
        const file = new File([blob], 'video-' + Date.now() + '.webm', { type: 'video/webm' });
        const url = await subirArchivo(file, 'video');
        await enviarMensajeMultimedia([url], 'video');
    } catch (error) {
        console.error('Error al subir video:', error);
    }
}

// ==========================================
// GRABACIÓN DE AUDIO Y VIDEO
// ==========================================
document.getElementById('btn-voice').addEventListener('click', async function() {
    if (!currentChatId) return;

    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaChunks = [];

            mediaRecorder.ondataavailable = function(e) {
                mediaChunks.push(e.data);
            };
            mediaRecorder.onstop = async function() {
                const blob = new Blob(mediaChunks, { type: 'audio/webm' });
                await subirAudio(blob);
            };

            mediaRecorder.start();
            document.getElementById('btn-voice').style.backgroundColor = '#e53e3e';
            alert('Grabando audio... Haz clic de nuevo para detener y enviar.');
        } catch (err) {
            console.error('Error al acceder al micrófono:', err);
        }
    } else {
        mediaRecorder.stop();
        document.getElementById('btn-voice').style.backgroundColor = '';
        mediaRecorder.stream.getTracks().forEach(function(t) { t.stop(); });
    }
});

document.getElementById('btn-video-msg').addEventListener('click', async function() {
    if (!currentChatId) return;

    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaChunks = [];

            mediaRecorder.ondataavailable = function(e) {
                mediaChunks.push(e.data);
            };
            mediaRecorder.onstop = async function() {
                const blob = new Blob(mediaChunks, { type: 'video/webm' });
                await subirVideo(blob);
            };

            mediaRecorder.start();
            document.getElementById('btn-video-msg').style.backgroundColor = '#e53e3e';
            alert('Grabando videomensaje... Haz clic de nuevo para detener y enviar.');
        } catch (err) {
            console.error('Error al acceder a la cámara:', err);
        }
    } else {
        mediaRecorder.stop();
        document.getElementById('btn-video-msg').style.backgroundColor = '';
        mediaRecorder.stream.getTracks().forEach(function(t) { t.stop(); });
    }
});

document.getElementById('btn-image').addEventListener('click', function() {
    if (!currentChatId) {
        alert('Primero abre un chat.');
        return;
    }
    imageInput.click();
});

imageInput.addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        await subirImagenes(files);
        imageInput.value = '';
    }
});

// ==========================================
// ELIMINAR MENSAJES Y CHATS
// ==========================================
async function eliminarMensaje(msgId) {
    try {
        const result = await supabaseClient
            .from('messages')
            .delete()
            .eq('id', msgId);

        if (result.error) throw result.error;
        
        await cargarMensajes();
        
    } catch (error) {
        console.error('Error al eliminar mensaje:', error);
    }
}

async function eliminarChat(chatId) {
    if (!confirm('¿Estás seguro de eliminar este chat?')) return;

    try {
        await supabaseClient
            .from('messages')
            .delete()
            .eq('chat_id', chatId);

        await supabaseClient
            .from('chats')
            .delete()
            .eq('id', chatId);

        await cargarContactos();
        
    } catch (error) {
        console.error('Error al eliminar chat:', error);
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================
contactsContainer.addEventListener('click', function(e) {
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
        e.stopPropagation();
        const contactItem = deleteBtn.closest('.contact-item');
        const chatId = contactItem.dataset.chatId;
        eliminarChat(chatId);
        return;
    }

    const contactItem = e.target.closest('.contact-item');
    if (contactItem) {
        abrirChat(contactItem.dataset.contactName, contactItem.dataset.chatId);
    }
});

messagesContainer.addEventListener('click', function(e) {
    if (e.target.closest('[data-action="delete-msg"]')) {
        const messageDiv = e.target.closest('.message');
        const msgId = messageDiv.dataset.msgId;
        eliminarMensaje(msgId);
    }
});

document.getElementById('btn-send').addEventListener('click', enviarMensajeTexto);

messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        enviarMensajeTexto();
    }
});

usernameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        iniciarSesion();
    }
});

passwordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        iniciarSesion();
    }
});

document.getElementById('btn-start').addEventListener('click', iniciarSesion);
document.getElementById('btn-register').addEventListener('click', crearCuenta);
document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
document.getElementById('btn-new-chat').addEventListener('click', crearNuevoChat);
document.getElementById('btn-back').addEventListener('click', cerrarChat);

// ==========================================
// INICIALIZACIÓN
// ==========================================
window.addEventListener('DOMContentLoaded', async function() {
    const result = await supabaseClient.auth.getSession();
    
    if (result.data.session) {
        await prepararSesion(result.data.session.user);
    } else {
        loginView.classList.add('active');
        chatListView.classList.remove('active');
    }
});