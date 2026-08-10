// ==========================================
// CONECTAVZLA - MODO WHATSAPP + AVATARES
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
const activeStatus = document.getElementById('active-status');
const contactsContainer = document.getElementById('contacts-container');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');
const imageInput = document.getElementById('image-input');
const searchInput = document.getElementById('search-contact');
const myAvatarImg = document.getElementById('my-avatar');
const contactAvatarImg = document.getElementById('contact-avatar');
const avatarInput = document.getElementById('avatar-input');
const statusView = document.getElementById('status-view');
const statusListContainer = document.getElementById('status-list');
const statusViewer = document.getElementById('status-viewer');
const statusImageInput = document.getElementById('status-image-input');

let currentContact = null;
let currentUser = null;
let currentUserId = null;
let currentChatId = null;
let currentOtherId = null;
let messageSubscription = null;
let presenceChannel = null;
let allContacts = [];
let otherOnlineFlag = false;
let typingFlag = false;
let typingTimer = null;
let lastTypingSent = 0;
let lastSeenLabel = '';
let mediaRecorder;
let mediaChunks = [];
let novedadesAgrupadas = [];
let pendingStatusText = '';
let visorActual = null;
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
// AUTENTICACIÓN
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
        .select('username, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle();

    if (result.data) {
        currentUser = result.data.username;
        if (myAvatarImg) {
            myAvatarImg.src = result.data.avatar_url || 'img/avatar.webp';
        }
    } else {
        currentUser = authUser.email.split('@')[0];
    }

    await supabaseClient
        .from('users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', currentUserId);

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
    salirPresencia();

    if (currentUserId) {
        await supabaseClient
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', currentUserId);
    }

    await supabaseClient.auth.signOut();
    currentUser = null;
    currentUserId = null;
    currentContact = null;
    currentChatId = null;
    currentOtherId = null;
    chatRoomView.classList.remove('active');
    chatListView.classList.remove('active');
    loginView.classList.add('active');
    passwordInput.value = '';
}

// ==========================================
// ESTADO EN LÍNEA / ESCRIBIENDO (PRESENCIA)
// ==========================================
function actualizarEstadoHeader() {
    if (!activeStatus) return;
    if (typingFlag) {
        activeStatus.textContent = 'escribiendo...';
    } else if (otherOnlineFlag) {
        activeStatus.textContent = 'En línea';
    } else {
        activeStatus.textContent = lastSeenLabel || 'desconectado';
    }
}

function unirsePresencia(chatId) {
    salirPresencia();

    presenceChannel = supabaseClient.channel('presencia-' + chatId, {
        config: { presence: { key: currentUserId } }
    });

    presenceChannel.on('presence', { event: 'sync' }, function() {
        const state = presenceChannel.presenceState();
        let online = false;
        Object.keys(state).forEach(function(key) {
            const arr = state[key];
            for (let i = 0; i < arr.length; i++) {
                if (arr[i].user_id && arr[i].user_id !== currentUserId) {
                    online = true;
                }
            }
        });
        otherOnlineFlag = online;
        actualizarEstadoHeader();
    });

    presenceChannel.on('broadcast', { event: 'typing' }, function() {
        typingFlag = true;
        actualizarEstadoHeader();
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(function() {
            typingFlag = false;
            actualizarEstadoHeader();
        }, 2500);
    });

    presenceChannel.subscribe(async function(status) {
        if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
                user_id: currentUserId,
                name: currentUser
            });
        }
    });
}

function salirPresencia() {
    if (presenceChannel) {
        presenceChannel.unsubscribe();
        supabaseClient.removeChannel(presenceChannel);
        presenceChannel = null;
    }
    otherOnlineFlag = false;
    typingFlag = false;
}

// ==========================================
// CONTACTOS (CHATS COMPARTIDOS)
// ==========================================
async function cargarContactos() {
    try {
        const result = await supabaseClient
            .from('chats')
            .select('*, messages(content, message_type, created_at)')
            .or('user_a_id.eq.' + currentUserId + ',user_b_id.eq.' + currentUserId)
            .order('created_at', { ascending: false });

        if (result.error) throw result.error;

        const chats = result.data;
        allContacts = [];

        // Cargar avatares de los usuarios
        const usersResult = await supabaseClient
            .from('users')
            .select('id, avatar_url');
        const avatarMap = {};
        if (!usersResult.error && usersResult.data) {
            usersResult.data.forEach(function(u) {
                avatarMap[u.id] = u.avatar_url;
            });
        }

        chats.forEach(function(chat) {
            const otherName = chat.user_a_id === currentUserId ? chat.user_b_name : chat.user_a_name;
            const otherId = chat.user_a_id === currentUserId ? chat.user_b_id : chat.user_a_id;
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

            allContacts.push({
                id: chat.id,
                name: otherName,
                otherId: otherId,
                lastMessage: lastMessage,
                time: time,
                avatar: avatarMap[otherId] || 'img/avatar.webp'
            });
        });

        renderContacts(allContacts);

    } catch (error) {
        console.error('Error al cargar contactos:', error);
    }
}

function renderContacts(contactsList) {
    contactsContainer.innerHTML = '';

    if (contactsList.length === 0) {
        contactsContainer.innerHTML = '<p style="text-align: center; padding: 20px; opacity: 0.7;">No tienes chats aún. ¡Agrega un usuario registrado con el botón ➕!</p>';
        return;
    }

    contactsList.forEach(function(contact) {
        const contactDiv = document.createElement('div');
        contactDiv.classList.add('contact-item');
        contactDiv.dataset.contactName = contact.name;
        contactDiv.dataset.chatId = contact.id;
        contactDiv.dataset.otherId = contact.otherId;

        const imgTag = '<img src="' + contact.avatar + '" alt="Avatar de ' + escapeHTML(contact.name) + '" class="avatar" onerror="this.src=\'img/avatar.webp\'">';
        const nameSpan = '<span class="contact-name">' + escapeHTML(contact.name) + '</span>';
        const timeSpan = '<span class="message-time">' + escapeHTML(contact.time) + '</span>';
        const lastMsg = '<p class="last-message">' + escapeHTML(contact.lastMessage) + '</p>';
        const deleteBtn = '<button class="btn-delete-contact" data-action="delete" title="Borrar chat">🗑️</button>';

        const html = '<div class="contact-info">' +
            '<div class="contact-row">' + nameSpan + timeSpan + '</div>' +
            '<div class="contact-row">' + lastMsg + '</div>' +
            '</div>';

        contactDiv.innerHTML = imgTag + html + deleteBtn;
        contactsContainer.appendChild(contactDiv);
    });
}

async function crearNuevoChat() {
    const newContactName = prompt('Ingresa el nombre de USUARIO REGISTRADO de tu contacto:');

    if (!newContactName || newContactName.trim() === '') return;
    const nameFormatted = newContactName.trim();

    if (nameFormatted.toLowerCase() === (currentUser || '').toLowerCase()) {
        alert('No puedes crear un chat contigo mismo.');
        return;
    }

    try {
        const userResult = await supabaseClient
            .from('users')
            .select('id, username')
            .ilike('username', nameFormatted)
            .maybeSingle();

        if (userResult.error || !userResult.data) {
            alert('Ese usuario NO está registrado en ConectaVzla. Pídele que cree su cuenta primero.');
            return;
        }

        const otherId = userResult.data.id;
        const otherName = userResult.data.username;

        // Normalizar el par (siempre mismo orden)
        let aId = currentUserId, aName = currentUser;
        let bId = otherId, bName = otherName;
        if (currentUserId > otherId) {
            aId = otherId; aName = otherName;
            bId = currentUserId; bName = currentUser;
        }

        // ¿Ya existe este chat?
        const existResult = await supabaseClient
            .from('chats')
            .select('id')
            .eq('user_a_id', aId)
            .eq('user_b_id', bId)
            .maybeSingle();

        let chatId;
        if (existResult.data) {
            chatId = existResult.data.id;
        } else {
            // ✅ CORREGIDO: usar columnas nuevas de la tabla chats
            const insertResult = await supabaseClient
                .from('chats')
                .insert([{
                    user_a_id: aId, user_a_name: aName,
                    user_b_id: bId, user_b_name: bName
                }])
                .select()
                .single();

            if (insertResult.error) {
                // Si falló por duplicado (caso raro: ambos se agregaron al mismo tiempo)
                if (insertResult.error.code === '23505') {
                    const retry = await supabaseClient
                        .from('chats')
                        .select('id')
                        .eq('user_a_id', aId)
                        .eq('user_b_id', bId)
                        .maybeSingle();
                    chatId = retry.data ? retry.data.id : null;
                } else {
                    throw insertResult.error;
                }
            } else {
                chatId = insertResult.data.id;
            }
        }

        if (!chatId) {
            alert('No se pudo crear el chat.');
            return;
        }

        await cargarContactos();
        await abrirChat(otherName, chatId, otherId);

    } catch (error) {
        console.error('Error al crear chat:', error);
    }
}

// ==========================================
// MENSAJES
// ==========================================
async function abrirChat(contactName, chatId, otherId) {
    currentContact = contactName;
    activeName.textContent = contactName;
    currentOtherId = otherId || null;

    if (!chatId || !currentOtherId) {
        const result = await supabaseClient
            .from('chats')
            .select('id, user_a_id, user_b_id, user_a_name, user_b_name')
            .or('user_a_id.eq.' + currentUserId + ',user_b_id.eq.' + currentUserId);

        if (!result.error && result.data) {
            for (let i = 0; i < result.data.length; i++) {
                const c = result.data[i];
                const other = c.user_a_id === currentUserId ? c.user_b_name : c.user_a_name;
                if (other === contactName) {
                    chatId = c.id;
                    currentOtherId = c.user_a_id === currentUserId ? c.user_b_id : c.user_a_id;
                    break;
                }
            }
        }

        if (!chatId) {
            console.error('Chat no encontrado');
            return;
        }
    }

    currentChatId = chatId;

    // ✅ NUEVO: Cargar avatar del contacto
    if (contactAvatarImg && currentOtherId) {
        const avResult = await supabaseClient
            .from('users')
            .select('avatar_url')
            .eq('id', currentOtherId)
            .maybeSingle();
        contactAvatarImg.src = (avResult.data && avResult.data.avatar_url)
            ? avResult.data.avatar_url
            : 'img/avatar.webp';
    }

    // Buscar "última vez" del contacto
    lastSeenLabel = 'desconectado';
    if (currentOtherId) {
        const seenResult = await supabaseClient
            .from('users')
            .select('last_seen')
            .eq('id', currentOtherId)
            .maybeSingle();

        if (seenResult.data && seenResult.data.last_seen) {
            lastSeenLabel = 'Últ. vez ' + formatTime(seenResult.data.last_seen);
        }
    }

    chatListView.classList.remove('active');
    chatRoomView.classList.add('active');
    actualizarEstadoHeader();

    await cargarMensajes();
    suscribirseAMensajes();
    unirsePresencia(chatId);
}

function cerrarChat() {
    if (messageSubscription) {
        messageSubscription.unsubscribe();
        messageSubscription = null;
    }
    salirPresencia();
    chatRoomView.classList.remove('active');
    chatListView.classList.add('active');
    currentContact = null;
    currentChatId = null;
    currentOtherId = null;
    cargarContactos();
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

        // Marcar como leídos los mensajes del contacto (doble check azul)
        supabaseClient
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('chat_id', currentChatId)
            .neq('sender_name', currentUser)
            .is('read_at', null)
            .then(function() {});

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

        // Doble check estilo WhatsApp
        let checks = '';
        if (isSent) {
            if (msg.read_at) {
                checks = '<span class="msg-checks read">✓✓</span>';
            } else {
                checks = '<span class="msg-checks">✓✓</span>';
            }
        }

        const firma = '<div class="msg-signature" style="font-size: 0.75rem; font-weight: bold; color: #0288D1; margin-bottom: 2px;">' + escapeHTML(msg.sender_name) + '</div>';
        const footer = '<div class="msg-footer"><span class="msg-time">' + formatTime(msg.created_at) + '</span>' + checks + '<button class="btn-delete" data-action="delete-msg" title="Borrar mensaje">×</button></div>';

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
                } else if (payload.eventType === 'UPDATE') {
                    cargarMensajes();
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
// SUBIR ARCHIVOS
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
// GRABACIÓN
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
// ELIMINAR
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
    if (!confirm('¿Eliminar este chat? Se eliminará para AMBOS usuarios.')) return;

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
        abrirChat(contactItem.dataset.contactName, contactItem.dataset.chatId, contactItem.dataset.otherId);
    }
});

messagesContainer.addEventListener('click', function(e) {
    if (e.target.closest('[data-action="delete-msg"]')) {
        const messageDiv = e.target.closest('.message');
        const msgId = messageDiv.dataset.msgId;
        eliminarMensaje(msgId);
    }
});

searchInput.addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    const filtered = allContacts.filter(function(c) {
        return c.name.toLowerCase().indexOf(term) !== -1;
    });
    renderContacts(filtered);
});

messageInput.addEventListener('input', function() {
    const now = Date.now();
    if (presenceChannel && now - lastTypingSent > 1500) {
        lastTypingSent = now;
        presenceChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { from: currentUser }
        });
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
document.getElementById('btn-export').addEventListener('click', exportarContactos);
document.getElementById('btn-change-pass').addEventListener('click', cambiarContrasena);
document.getElementById('btn-status-tab').addEventListener('click', abrirNovedades);
document.getElementById('btn-status-back').addEventListener('click', cerrarNovedades);
document.getElementById('viewer-close').addEventListener('click', cerrarVisorNovedad);
document.getElementById('viewer-prev').addEventListener('click', visorAnterior);
document.getElementById('viewer-next').addEventListener('click', visorSiguiente);
document.getElementById('viewer-delete').addEventListener('click', eliminarNovedadActual);
setInterval(function() {
    if (currentUserId) {
        supabaseClient
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', currentUserId)
            .then(function() {});
    }
}, 60000);

// ==========================================
// ✅ CAMBIAR AVATAR (NUEVO)
// ==========================================
if (myAvatarImg) {
    myAvatarImg.addEventListener('click', function() {
        avatarInput.click();
    });
}

if (avatarInput) {
    avatarInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const url = await subirArchivo(file, 'images');

            const result = await supabaseClient
                .from('users')
                .update({ avatar_url: url })
                .eq('id', currentUserId);

            if (result.error) throw result.error;

            myAvatarImg.src = url;
            await cargarContactos();
        } catch (error) {
            console.error('Error al cambiar el avatar:', error);
        }

        avatarInput.value = '';
    });
}
// ==========================================
// EXPORTAR CONTACTOS (TEXTO)
// ==========================================
function exportarContactos() {
    if (allContacts.length === 0) {
        alert('No tienes contactos para exportar.');
        return;
    }

    const fecha = new Date().toLocaleString();

    let contenido = 'CONTACTOS DE CONECTAVZLA\n';
    contenido += 'Usuario: ' + currentUser + '\n';
    contenido += 'Fecha: ' + fecha + '\n';
    contenido += '--------------------------------\n';
    allContacts.forEach(function(c, i) {
        contenido += (i + 1) + '. ' + c.name + '\n';
    });
    contenido += '--------------------------------\n';
    contenido += 'Total de contactos: ' + allContacts.length + '\n';

    const blob = new Blob([contenido], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'contactos-conectavzla.txt';
    enlace.click();
    URL.revokeObjectURL(url);
}
// ==========================================
// CAMBIAR CONTRASEÑA
// ==========================================
async function cambiarContrasena() {
    const nueva = prompt('Escribe tu NUEVA contraseña (mínimo 6 caracteres):');
    if (!nueva) return;

    if (nueva.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    const confirma = prompt('Repite la nueva contraseña:');
    if (confirma !== nueva) {
        alert('Las contraseñas no coinciden. No se cambió nada.');
        return;
    }

    try {
        const result = await supabaseClient.auth.updateUser({ password: nueva });

        if (result.error) throw result.error;

        alert('✅ Contraseña actualizada. Úsala la próxima vez que entres.');
    } catch (error) {
        console.error('Error al cambiar la contraseña:', error);
        alert('No se pudo cambiar la contraseña. Intenta de nuevo.');
    }
}
// ==========================================
// NOVEDADES (ESTADOS 24 HORAS)
// ==========================================
function abrirNovedades() {
    chatListView.classList.remove('active');
    statusView.classList.add('active');
    cargarNovedades();
}

function cerrarNovedades() {
    statusView.classList.remove('active');
    chatListView.classList.add('active');
}

async function cargarNovedades() {
    try {
        const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Limpiar mis novedades vencidas
        supabaseClient
            .from('statuses')
            .delete()
            .eq('user_id', currentUserId)
            .lt('created_at', limite24h)
            .then(function() {});

        const result = await supabaseClient
            .from('statuses')
            .select('*')
            .gte('created_at', limite24h)
            .order('created_at', { ascending: false });

        if (result.error) throw result.error;

        const usersResult = await supabaseClient
            .from('users')
            .select('id, avatar_url');
        const avatarMap = {};
        if (!usersResult.error && usersResult.data) {
            usersResult.data.forEach(function(u) {
                avatarMap[u.id] = u.avatar_url;
            });
        }

        const porUsuario = {};
        result.data.forEach(function(st) {
            if (!porUsuario[st.user_id]) {
                porUsuario[st.user_id] = {
                    userId: st.user_id,
                    username: st.username,
                    avatar: avatarMap[st.user_id] || 'img/avatar.webp',
                    items: []
                };
            }
            porUsuario[st.user_id].items.push(st);
        });

        novedadesAgrupadas = Object.values(porUsuario);
        renderNovedades();

    } catch (error) {
        console.error('Error al cargar novedades:', error);
    }
}

function renderNovedades() {
    statusListContainer.innerHTML = '';

    // Fila "Mi estado"
    const myDiv = document.createElement('div');
    myDiv.classList.add('status-item');
    myDiv.innerHTML = '<div style="position:relative;">' +
        '<img src="' + (myAvatarImg ? myAvatarImg.src : 'img/avatar.webp') + '" class="avatar status-avatar">' +
        '<span class="status-add-badge">+</span></div>' +
        '<div class="contact-info"><span class="contact-name">Mi estado</span>' +
        '<p class="last-message">Toca para agregar una novedad</p></div>';
    myDiv.addEventListener('click', publicarNovedad);
    statusListContainer.appendChild(myDiv);

    if (novedadesAgrupadas.length === 0) {
        const empty = document.createElement('p');
        empty.style.textAlign = 'center';
        empty.style.padding = '20px';
        empty.style.opacity = '0.7';
        empty.textContent = 'No hay novedades en las últimas 24 horas.';
        statusListContainer.appendChild(empty);
        return;
    }

    novedadesAgrupadas.forEach(function(grupo, index) {
        const div = document.createElement('div');
        div.classList.add('status-item');
        const esMio = grupo.userId === currentUserId;
        div.innerHTML = '<img src="' + grupo.avatar + '" class="avatar status-avatar' + (esMio ? '' : ' status-ring') + '">' +
            '<div class="contact-info"><span class="contact-name">' + escapeHTML(grupo.username) + (esMio ? ' (tú)' : '') + '</span>' +
            '<p class="last-message">' + grupo.items.length + ' novedad(es) · ' + formatTime(grupo.items[0].created_at) + '</p></div>';
        div.addEventListener('click', function() {
            abrirVisorNovedad(index);
        });
        statusListContainer.appendChild(div);
    });
}

async function publicarNovedad() {
    const texto = prompt('Escribe el texto de tu novedad (o deja vacío y pulsa Aceptar):');
    const contenido = texto === null ? '' : texto.trim();

    const quiereFoto = confirm('¿Agregar una foto a tu novedad?');

    if (!quiereFoto && contenido === '') {
        alert('Tu novedad está vacía. Escribe algo o agrega una foto.');
        return;
    }

    if (quiereFoto) {
        pendingStatusText = contenido;
        statusImageInput.click();
        return;
    }

    await insertarNovedad(contenido, null);
}

statusImageInput.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    statusImageInput.value = '';
    if (!file) return;

    try {
        const url = await subirArchivo(file, 'images');
        await insertarNovedad(pendingStatusText || null, url);
    } catch (err) {
        console.error('Error al subir la foto de la novedad:', err);
    }
});

async function insertarNovedad(contenido, imageUrl) {
    try {
        const result = await supabaseClient
            .from('statuses')
            .insert([{
                user_id: currentUserId,
                username: currentUser,
                content: contenido,
                image_url: imageUrl
            }]);

        if (result.error) throw result.error;

        await cargarNovedades();
    } catch (error) {
        console.error('Error al publicar novedad:', error);
    }
}

// ---------- Visor de novedades ----------
function abrirVisorNovedad(grupoIndex) {
    const grupo = novedadesAgrupadas[grupoIndex];
    if (!grupo) return;
    visorActual = { items: grupo.items, pos: 0, username: grupo.username, avatar: grupo.avatar };
    mostrarVisorPosicion();
    statusViewer.classList.add('visible');
}

function mostrarVisorPosicion() {
    const item = visorActual.items[visorActual.pos];

    document.getElementById('viewer-name').textContent = visorActual.username;
    document.getElementById('viewer-time').textContent = formatTime(item.created_at);
    document.getElementById('viewer-avatar').src = visorActual.avatar;
    document.getElementById('viewer-counter').textContent = (visorActual.pos + 1) + ' / ' + visorActual.items.length;

    const img = document.getElementById('viewer-image');
    if (item.image_url) {
        img.src = item.image_url;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
    }

    const txt = document.getElementById('viewer-text');
    if (item.content) {
        txt.textContent = item.content;
        txt.style.display = 'block';
    } else {
        txt.style.display = 'none';
    }

    document.getElementById('viewer-delete').style.display =
        (item.user_id === currentUserId) ? 'block' : 'none';
}

function visorAnterior() {
    if (visorActual && visorActual.pos > 0) {
        visorActual.pos--;
        mostrarVisorPosicion();
    }
}

function visorSiguiente() {
    if (visorActual && visorActual.pos < visorActual.items.length - 1) {
        visorActual.pos++;
        mostrarVisorPosicion();
    } else {
        cerrarVisorNovedad();
    }
}

function cerrarVisorNovedad() {
    statusViewer.classList.remove('visible');
    visorActual = null;
}

async function eliminarNovedadActual() {
    if (!visorActual) return;
    const item = visorActual.items[visorActual.pos];
    if (!confirm('¿Eliminar esta novedad?')) return;

    const result = await supabaseClient
        .from('statuses')
        .delete()
        .eq('id', item.id);

    if (result.error) {
        console.error(result.error);
        return;
    }

    cerrarVisorNovedad();
    await cargarNovedades();
}
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
