// ==========================================
// CONECTAVZLA: LÓGICA DE INTERFAZ Y MULTIMEDIA
// ==========================================

const MAX_MESSAGES = 10; // Límite estricto de 10 mensajes activos

// Elementos del DOM (Vistas principales)
const loginView = document.getElementById('login-view');
const chatListView = document.getElementById('chat-list-view');
const chatRoomView = document.getElementById('chat-room-view');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const activeName = document.getElementById('active-name');
const contactsContainer = document.getElementById('contacts-container');

// Elementos del DOM para Llamadas
const callScreenView = document.getElementById('call-screen-view');
const callStatus = document.getElementById('call-status');
const callName = document.getElementById('call-name');

// Elemento del DOM para Login
const usernameInput = document.getElementById('username-input');

// ESTADO DE LA APLICACIÓN
let currentContact = null;
let currentUser = null;
let nextId = 1;

// Historiales independientes indexados por nombre de contacto (ConectVzla por defecto)
let chatHistories = {
    "ConectVzla": [
        { id: nextId++, text: "Bienvenido a ConectaVzla", sender: "received", time: "00:00 AM" },
        { id: nextId++, text: "Gracias", sender: "sent", time: "00:01 AM" }
    ]
};

let contactsList = [
    { 
        name: "ConectaVzla", 
        lastMessage: "Gracias", 
        time: "00:01 AM",
        avatar: "img/avatar.webp"
    }
];

// Variables para control de grabación multimedia
let mediaRecorder;
let mediaChunks = [];

// ==========================================
// FUNCIONES DE SEGURIDAD Y RENDERIZADO
// ==========================================

// Previene ataques XSS escapando caracteres HTML maliciosos
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function renderContacts() {
    contactsContainer.innerHTML = '';

    contactsList.forEach(contact => {
        const contactDiv = document.createElement('div');
        contactDiv.classList.add('contact-item');
        contactDiv.dataset.contactName = contact.name;

        const avatarUrl = contact.avatar || "img/avatar.webp";

        contactDiv.innerHTML = `
            <img src="${avatarUrl}" 
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

function renderMessages() {
    messagesContainer.innerHTML = '';
    
    const history = chatHistories[currentContact] || [];
    const messagesToDisplay = history.slice(-MAX_MESSAGES);

    messagesToDisplay.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', msg.sender);
        messageDiv.dataset.msgId = msg.id;
        
        const firmaEmisor = msg.senderName ? escapeHTML(msg.senderName) : (msg.sender === 'sent' ? 'Tú' : currentContact);

        // Si el mensaje contiene HTML seguro (como reproductores de audio/video), se renderiza directamente
        const cuerpoMensaje = msg.isHtml ? msg.text : `<p>${escapeHTML(msg.text)}</p>`;

        messageDiv.innerHTML = `
            <div class="msg-signature" style="font-size: 0.75rem; font-weight: bold; color: #0288D1; margin-bottom: 2px;">
                ${firmaEmisor}
            </div>
            ${cuerpoMensaje}
            <div class="msg-footer">
                <span class="msg-time">${escapeHTML(msg.time)}</span>
                <button class="btn-delete" data-action="delete-msg" title="Borrar mensaje">×</button>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ==========================================
// LÓGICA DE USUARIO Y SESIÓN
// ==========================================

function inicializarUsuarioActual(nombre) {
    currentUser = nombre;
    localStorage.setItem("usuarioActual", currentUser);
}

function registrarUsuario() {
    const nombreUsuario = usernameInput.value.trim();

    if (nombreUsuario === "") {
        alert("Por favor, ingresa un nombre válido.");
        return;
    }

    inicializarUsuarioActual(nombreUsuario);

    loginView.classList.remove('active');
    chatListView.classList.add('active');

    renderContacts();
}

// ==========================================
// LÓGICA DE NEGOCIO Y MENSAJERÍA
// ==========================================

function openChat(contactName) {
    currentContact = contactName;
    activeName.textContent = contactName;
    
    if (!chatHistories[currentContact]) {
        chatHistories[currentContact] = [];
    }

    chatListView.classList.remove('active');
    chatRoomView.classList.add('active');
    renderMessages();
}

function closeChat() {
    chatRoomView.classList.remove('active');
    chatListView.classList.add('active');
    currentContact = null;
}

function deleteMessage(msgId) {
    if (!currentContact) return;
    
    chatHistories[currentContact] = chatHistories[currentContact].filter(msg => msg.id !== msgId);
    renderMessages();
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || !currentContact) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMessage = {
        id: nextId++,
        text: text,
        isHtml: false,
        sender: "sent",
        senderName: currentUser || "Tú",
        time: timeString
    };

    chatHistories[currentContact].push(newMessage);

    const contactIndex = contactsList.findIndex(c => c.name === currentContact);
    if (contactIndex !== -1) {
        contactsList[contactIndex].lastMessage = text;
        contactsList[contactIndex].time = timeString;
        const updatedContact = contactsList.splice(contactIndex, 1)[0];
        contactsList.unshift(updatedContact);
    }

    messageInput.value = '';
    renderMessages();
    renderContacts();
}

// ==========================================
// GRABACIÓN DE NOTAS DE VOZ Y VIDEOMENSAJES
// ==========================================

function registrarElementoMultimedia(url, tipo) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let contenidoHtml = '';
    let descripcionUltimoMensaje = '';

    if (tipo === 'audio') {
        contenidoHtml = `<audio controls src="${url}"></audio>`;
        descripcionUltimoMensaje = "🎤 Nota de voz";
    } else if (tipo === 'video') {
        contenidoHtml = `<video controls src="${url}"></video>`;
        descripcionUltimoMensaje = "📹 Videomensaje";
    }

    const newMessage = {
        id: nextId++,
        text: contenidoHtml,
        isHtml: true,
        sender: "sent",
        senderName: currentUser || "Tú",
        time: timeString
    };

    if (!chatHistories[currentContact]) {
        chatHistories[currentContact] = [];
    }

    chatHistories[currentContact].push(newMessage);

    const contactIndex = contactsList.findIndex(c => c.name === currentContact);
    if (contactIndex !== -1) {
        contactsList[contactIndex].lastMessage = descripcionUltimoMensaje;
        contactsList[contactIndex].time = timeString;
        const updatedContact = contactsList.splice(contactIndex, 1)[0];
        contactsList.unshift(updatedContact);
    }

    renderMessages();
    renderContacts();
}

// Evento Nota de Voz (Micrófono)
document.getElementById('btn-voice').addEventListener('click', async () => {
    if (!currentContact) return;

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaChunks = [];

            mediaRecorder.ondataavailable = e => mediaChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(mediaChunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                registrarElementoMultimedia(url, 'audio');
            };

            mediaRecorder.start();
            document.getElementById('btn-voice').style.backgroundColor = "#e53e3e";
            alert("Grabando audio... Haz clic de nuevo en el micrófono para detener y enviar.");
        } catch (err) {
            alert("No se pudo acceder al micrófono.");
        }
    } else {
        mediaRecorder.stop();
        document.getElementById('btn-voice').style.backgroundColor = "";
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
});

// Evento Videomensaje Corto (Cámara)
document.getElementById('btn-video-msg').addEventListener('click', async () => {
    if (!currentContact) return;

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaChunks = [];

            mediaRecorder.ondataavailable = e => mediaChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(mediaChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                registrarElementoMultimedia(url, 'video');
            };

            mediaRecorder.start();
            document.getElementById('btn-video-msg').style.backgroundColor = "#e53e3e";
            alert("Grabando videomensaje... Haz clic de nuevo en la cámara para detener y enviar.");
        } catch (err) {
            alert("No se pudo acceder a la cámara o micrófono.");
        }
    } else {
        mediaRecorder.stop();
        document.getElementById('btn-video-msg').style.backgroundColor = "";
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
});

// ==========================================
// GESTIÓN DE LLAMADAS Y SIMULACIONES
// ==========================================

function startCall(type) {
    if (!currentContact) return;
    callName.textContent = currentContact;
    callStatus.textContent = type === 'video' ? "Videollamada saliente..." : "Llamada de voz saliente...";
    callScreenView.classList.add('active');

    setTimeout(() => {
        if (callScreenView.classList.contains('active')) {
            callStatus.textContent = "En llamada (0:01)";
        }
    }, 2000);
}

function endCall() {
    callScreenView.classList.remove('active');
    callStatus.textContent = "Llamando...";
}

// ==========================================
// DELEGACIÓN DE EVENTOS Y LISTENERS
// ==========================================

contactsContainer.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
        e.stopPropagation();
        const contactItem = deleteBtn.closest('.contact-item');
        const contactName = contactItem.dataset.contactName;

        if (confirm(`¿Estás seguro de eliminar el chat con ${contactName}?`)) {
            contactsList = contactsList.filter(c => c.name !== contactName);
            delete chatHistories[contactName];
            renderContacts();
        }
        return;
    }

    const contactItem = e.target.closest('.contact-item');
    if (contactItem) {
        openChat(contactItem.dataset.contactName);
    }
});

messagesContainer.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="delete-msg"]')) {
        const messageDiv = e.target.closest('.message');
        const msgId = parseInt(messageDiv.dataset.msgId, 10);
        deleteMessage(msgId);
    }
});

document.getElementById('btn-send').addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

if (usernameInput) {
    usernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            registrarUsuario();
        }
    });
}
const btnStart = document.getElementById('btn-start');
if (btnStart) {
    btnStart.addEventListener('click', registrarUsuario);
}

document.getElementById('btn-new-chat').addEventListener('click', function() {
    const newContactName = prompt("Ingresa el nombre del nuevo contacto:");
    
    if (newContactName && newContactName.trim() !== "") {
        const nameFormatted = newContactName.trim();
        const exists = contactsList.some(c => c.name.toLowerCase() === nameFormatted.toLowerCase());
        
        if (!exists) {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            contactsList.unshift({
                name: nameFormatted,
                lastMessage: "¡Nuevo chat iniciado!",
                time: timeString,
                avatar: "img/avatar.webp"
            });
            chatHistories[nameFormatted] = [];
            renderContacts();
        }
        openChat(nameFormatted);
    }
});

document.getElementById('btn-voice-call').addEventListener('click', () => startCall('voice'));
document.getElementById('btn-video-call').addEventListener('click', () => startCall('video'));
document.getElementById('btn-end-call').addEventListener('click', endCall);


// ==========================================
// INICIALIZACIÓN DE LA APLICACIÓN AL CARGAR
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const usuarioGuardado = localStorage.getItem("usuarioActual");
    
    if (usuarioGuardado) {
        inicializarUsuarioActual(usuarioGuardado);
        loginView.classList.remove('active');
        chatListView.classList.add('active');
        renderContacts();
    } else {
        loginView.classList.add('active');
        chatListView.classList.remove('active');
    }
});
