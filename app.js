// ==========================================
// CHATVEN-LIGHT: LÓGICA DE INTERFAZ Y DATOS
// ==========================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://cwfhufcvnmvwpppfpcuy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3Zmh1ZmN2bm12d3BwcGZwY3V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1Nzc1MDUsImV4cCI6MjEwMTE1MzUwNX0.rSCUty5TPlBz8mIo6x5xp-xigpxraCt6kfLAjwowP0I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_MESSAGES = 20; // Límite actualizado a 20 mensajes

// Elementos del DOM
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

// ESTADO DE LA APLICACIÓN
let currentContact = null;
let nextId = 1;

// Historiales independientes indexados por nombre de contacto
let chatHistories = {
    "Ana García": [
        { id: nextId++, text: "Hola, ¿cómo estás?", sender: "received", time: "10:40 AM" },
        { id: nextId++, text: "Todo bien por aquí, listo para arrancar.", sender: "sent", time: "10:42 AM" }
    ]
};

// 1. CAMBIO: Se agrega la propiedad 'avatar' a los contactos iniciales
let contactsList = [
    { 
        name: "Ana García", 
        lastMessage: "🎤 Nota de voz (0:12)", 
        time: "10:45 AM",
        avatar: "img/avatar.webp" // Ruta de la imagen del usuario
    }
];

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
        contactDiv.dataset.contactName = contact.name; // Seguro ante comillas y caracteres especiales

        // 2. CAMBIO: Usamos el avatar del contacto o uno por defecto si no existe
        const avatarUrl = contact.avatar || "img/avatar.webp";

        contactDiv.innerHTML = `
            <img src="${avatarUrl}" 
                 alt="Avatar de ${escapeHTML(contact.name)}" 
                 class="avatar" 
                 onerror="this.src='img/avatar.webp'"> <!-- Fallback automático si la imagen falla -->
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
    
    // Obtener exclusivamente el historial del contacto actual
    const history = chatHistories[currentContact] || [];
    const messagesToDisplay = history.slice(-MAX_MESSAGES);

    messagesToDisplay.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', msg.sender);
        messageDiv.dataset.msgId = msg.id;
        
        messageDiv.innerHTML = `
            <p>${escapeHTML(msg.text)}</p>
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
// LÓGICA DE NEGOCIO
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
        sender: "sent",
        time: timeString
    };

    chatHistories[currentContact].push(newMessage);

    // Actualizar vista previa y mover contacto al inicio de la lista
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
// GESTIÓN DE LLAMADAS Y VIDEOLLAMADAS
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

// Delegación para lista de contactos (Apertura y borrado)
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

// Delegación para borrar mensajes individuales
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

// Simulación de nota de voz
document.getElementById('btn-voice').addEventListener('click', function() {
    if (!currentContact) return;
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    chatHistories[currentContact].push({
        id: nextId++,
        text: "🎤 Nota de voz (0:05)",
        sender: "sent",
        time: timeString
    });

    renderMessages();
});

// Botón de nuevo chat
document.getElementById('btn-new-chat').addEventListener('click', function() {
    const newContactName = prompt("Ingresa el nombre del nuevo contacto:");
    
    if (newContactName && newContactName.trim() !== "") {
        const nameFormatted = newContactName.trim();
        const exists = contactsList.some(c => c.name.toLowerCase() === nameFormatted.toLowerCase());
        
        if (!exists) {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // 3. CAMBIO: Se agrega el avatar por defecto al crear un nuevo contacto
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

// Controles de llamadas
document.getElementById('btn-voice-call').addEventListener('click', () => startCall('voice'));
document.getElementById('btn-video-call').addEventListener('click', () => startCall('video'));
document.getElementById('btn-end-call').addEventListener('click', endCall);

// Inicialización de la aplicación
renderContacts();
