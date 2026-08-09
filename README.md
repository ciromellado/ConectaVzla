<div align="center">

# 💬 ConectaVzla

### Mensajería instantánea moderna para conectar a las personas que importan

<img src="img/logo.webp" alt="Logo ConectaVzla" width="120" />

**Una PWA de mensajería construida con Supabase, tiempo real y corazón venezolano** 🇻🇪

</div>

---

## 📖 Descripción

**ConectaVzla** es una aplicación web de mensajería instantánea que combina la experiencia de WhatsApp con la libertad de una aplicación web moderna. Permite a dos usuarios comunicarse en tiempo real a través de mensajes de texto, notas de voz, videomensajes e imágenes, sin necesidad de compartir números telefónicos ni correos electrónicos.

Construida como **Progressive Web App (PWA)**, se instala directamente desde el navegador y funciona como una aplicación nativa en Android, iOS y escritorio, con datos sincronizados en la nube gracias a **Supabase**.

---

## ✨ Características principales

### 💬 Comunicación
- 📨 **Mensajes de texto** en tiempo real
- 🎤 **Notas de voz** con grabación integrada
- 📹 **Videomensajes** con grabación desde cámara
- 📷 **Imágenes** (hasta 2 por mensaje)
- 🔊 **Sonido personalizado** al recibir mensajes

### 🟢 Estado de conexión (estilo WhatsApp)
- ✓✓ **Doble check** (gris = enviado, azul = leído)
- 🟢 **"En línea"** cuando tu contacto está en el chat
- ⌨️ **"Escribiendo..."** mientras escribe
- 🕐 **"Últ. vez"** cuando se desconecta

### 🔐 Seguridad
- 👤 Cuentas con **usuario y contraseña** (Supabase Auth)
- 🔒 Chats privados con políticas RLS (Row Level Security)
- 🗑️ Eliminación de mensajes y chats
- 🛡️ Cada usuario solo ve sus propias conversaciones

### 📱 Experiencia
- 🚀 PWA instalable en Android, iPhone y escritorio
- 💨 Carga instantánea con Service Worker
- 🔍 Buscador de chats integrado
- 🎨 Interfaz inspirada en WhatsApp con estética personalizada
- 📱 Diseño responsive optimizado para móviles (incluidos Xiaomi/Redmi)

### ☁️ Backend
- 🗄️ Base de datos PostgreSQL en la nube (Supabase)
- 💾 Almacenamiento de archivos multimedia (Storage)
- ⚡ Sincronización en tiempo real (Realtime)
- 🌍 Acceso desde cualquier dispositivo con internet

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | HTML5 · CSS3 · JavaScript Vanilla |
| **Backend** | [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage + Realtime) |
| **Hosting** | [GitHub Pages](https://pages.github.com/) |
| **PWA** | Service Worker · Manifest JSON |
| **Versionado** | Git · GitHub |

---

## 🚀 Instalación y uso

### 🌐 Uso directo (sin instalación)

1. Visita la URL pública de la app: `https://ciromellado.github.io/ConectaVzla/`
2. Crea tu cuenta con un nombre de usuario y contraseña
3. ¡Listo! Ya puedes chatear

### 📱 Instalación como app

#### Android (Chrome)
1. Abre la app en Chrome
2. Toca **⋮** → **"Instalar app"**
3. Confirma y el ícono aparecerá en tu pantalla de inicio

#### iPhone (Safari)
1. Abre la app en Safari
2. Toca **Compartir** ⬆️ → **"Agregar a pantalla de inicio"**

#### PC (Chrome / Edge)
1. Abre la app en Chrome o Edge
2. Clic en el ícono de **instalación** (⬇) en la barra de direcciones
3. Confirma → ícono en el escritorio

### 💑 Cómo chatear con otra persona

1. **Ambos** crean su cuenta con usuario y contraseña únicos
2. Uno de los dos toca el botón **➕** en la lista de chats
3. Escribe el **nombre exacto** del contacto registrado
4. El chat aparece en **ambos dispositivos** automáticamente
5. ¡A conversar en tiempo real! ⚡

---

## 📂 Estructura del proyecto

