// ==========================================
// CHATVEN-LIGHT: LÓGICA DE INTERFAZ Y DATOS
// ==========================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://cwfhufcvnmvwpppfpcuy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3Zmh1ZmN2bm12d3BwcGZwY3V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1Nzc1MDUsImV4cCI6MjEwMTE1MzUwNX0.rSCUty5TPlBz8mIo6x5xp-xigpxraCt6kfLAjwowP0I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_MESSAGES = 20;

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
let contactsList = [];
let currentMessages = [];

// ==========================================
// FUNCIONES DE SEGURIDAD Y RENDERIZADO
// ==========================================

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
                    <span class="message-time">${escapeHTML(contact.time || '')}</span>
                </div>
                <div class="contact-row">
                    <p class="last-message">${escapeHTML(contact.last_message || '¡Nuevo chat iniciado!')}</p>
                </div>
            </div>
            <button class="btn-delete-contact" data-action="delete" title="Borrar chat y contacto">🗑️</button>
        `;
        contactsContainer.appendChild(contactDiv);
    });
}

function renderMessages() {
    messagesContainer.innerHTML = '';
    
    const messagesToDisplay = currentMessages.slice(-MAX_MESSAGES);

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
// OPERACIONES CON SUPABASE (BASE DE DATOS)
// ==========================================

async function cargarContactosDesdeDB() {
    const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('Error al cargar contactos:', error);
        return;
    }

    contactsList = data || [];
    
    // Si la lista está vacía por defecto, creamos un contacto inicial de prueba
    if (contactsList.length === 0) {
        await crearContactoDB("Ana García", "Hola, ¿cómo estás?", "10:45 AM");
        return;
    }
    
    renderContacts();
}

async function crearContactoDB(nombre, lastMsg, timeStr) {
    const { data, error } = await supabase
        .from('contacts')
        .insert([{ 
            name: nombre, 
            last_message: lastMsg, 
            time: timeStr, 
            avatar: "img/avatar.webp" 
        }])
        .select();

    if (!error && data) {
        contactsList.unshift(data[0]);
        renderContacts();
    }
}

async function cargarMensajesDB(nombreContacto) {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('contact_name', nombreContacto)
        .order('id', { ascending: true });

    if (error) {
        console.error('Error al cargar mensajes:', error);
        currentMessages = [];
    } else {
        currentMessages = data || [];
    }
    renderMessages();
}

// ==========================================
// LÓGICA DE NEGOCIO
// ==========================================

async function openChat(contactName) {
    currentContact = contactName;
    activeName.textContent = contactName;
    
    chatListView.classList.remove('active');
    chatRoomView.classList.add('active');
    
    await cargarMensajesDB(contactName);
}

function closeChat() {
    chatRoomView.classList.remove('active');
    chatListView.classList.add('active');
    currentContact = null;
    cargarContactosDesdeDB(); // Actualizar lista al salir
}

async function deleteMessage(msgId) {
    const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', msgId);

    if (!error) {
        currentMessages = currentMessages.filter(msg => msg.id !== msgId);
        renderMessages();
    }
}

async function sendMessageText(textCustom) {
    const text = textCustom || messageInput.value.trim();
    if (text === '' || !currentContact) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Guardar mensaje en Supabase
    const { data, error } = await supabase
        .from('messages')
        .insert([{ 
            contact_name: currentContact, 
            text: text, 
            sender: "sent", 
            time: timeString 
        }])
        .select();

    if (error) {
        console.error('Error al enviar mensaje:', error);
        return;
    }

    if (data) {
        currentMessages.push(data[0]);
    }

    // 2. Actualizar último mensaje del contacto en Supabase
    await supabase
        .from('contacts')
        .update({ last_message: text, time: timeString })
        .eq('name', currentContact);

    messageInput.value = '';
    renderMessages();
    cargarContactosDesdeDB();
}

// ==========================================
// GESTIÓN DE LLAMADAS
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
// EVENTOS Y LISTENERS
// ==========================================

contactsContainer.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
        e.stopPropagation();
        const contactItem = deleteBtn.closest('.contact-item');
        const contactName = contactItem.dataset.contactName;

        if (confirm(`¿Estás seguro de eliminar el chat con ${contactName}?`)) {
            await supabase.from('contacts').delete().eq('name', contactName);
            await supabase.from('messages').delete().eq('contact_name', contactName);
            cargarContactosDesdeDB();
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

document.getElementById('btn-send').addEventListener('click', () => sendMessageText());

messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessageText();
    }
});

// Nota de voz
document.getElementById('btn-voice').addEventListener('click', function() {
    if (!currentContact) return;
    sendMessageText("🎤 Nota de voz (0:05)");
});

// Botón de nuevo chat
document.getElementById('btn-new-chat').addEventListener('click', async function() {
    const newContactName = prompt("Ingresa el nombre del nuevo contacto:");
    
    if (newContactName && newContactName.trim() !== "") {
        const nameFormatted = newContactName.trim();
        const exists = contactsList.some(c => c.name.toLowerCase() === nameFormatted.toLowerCase());
        
        if (!exists) {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            await crearContactoDB(nameFormatted, "¡Nuevo chat iniciado!", timeString);
        }
        openChat(nameFormatted);
    }
});

// Controles de llamadas
document.getElementById('btn-voice-call').addEventListener('click', () => startCall('voice'));
document.getElementById('btn-video-call').addEventListener('click', () => startCall('video'));
document.getElementById('btn-end-call').addEventListener('click', endCall);

// Botón de retroceso en la sala de chat (asegúrate de que tu HTML tenga este evento o clase si aplica)
const btnBack = document.getElementById('btn-back');
if (btnBack) {
    btnBack.addEventListener('click', closeChat);
}

// Inicialización de la aplicación al cargar la página
cargarContactosDesdeDB();
