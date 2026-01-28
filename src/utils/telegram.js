/**
 * Telegram Bot Notifications
 * Sends notifications to Telegram channel/chat
 */

// Bot token from @BotFather
const BOT_TOKEN = '8472569206:AAFWuO0yHYtEhPGlfArna16zqJdsC_UyWWE'

// Chat ID канала 808.help
const CHAT_ID = '-1003872768894'

/**
 * Send message to Telegram
 */
export async function sendTelegramMessage(message) {
  if (BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.warn('Telegram bot token not configured')
    return false
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    )

    const data = await response.json()
    
    if (!data.ok) {
      console.error('Telegram error:', data.description)
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to send Telegram message:', error)
    return false
  }
}

/**
 * Format and send dispute notification
 */
export async function notifyDispute(dispute) {
  const reasonLabels = {
    'not-working': '❌ Файл не работает',
    'not-as-expected': '⚠️ Не соответствует описанию',
    'other': '❓ Другое'
  }

  const message = `
🚨 <b>НОВЫЙ СПОР</b>

📋 <b>Сделка:</b> #${dispute.purchaseId?.slice(-8) || 'N/A'}
🎵 <b>Бит:</b> ${dispute.beatTitle}
💰 <b>Сумма:</b> $${dispute.amount?.toFixed(2) || '0.00'}

👤 <b>Покупатель:</b> ${dispute.buyerName}
🎹 <b>Продавец:</b> ${dispute.sellerName}

📝 <b>Причина:</b> ${reasonLabels[dispute.reason] || dispute.reason}
💬 <b>Описание:</b> ${dispute.description || 'Не указано'}

⏰ <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}
`

  return await sendTelegramMessage(message)
}

/**
 * Format and send new purchase notification
 */
export async function notifyPurchase(purchase) {
  const message = `
💰 <b>НОВАЯ ПОКУПКА</b>

📋 <b>Сделка:</b> #${purchase.id?.slice(-8) || 'N/A'}
🎵 <b>Бит:</b> ${purchase.beatTitle}
💵 <b>Сумма:</b> $${purchase.price?.toFixed(2)}
📜 <b>Лицензия:</b> ${purchase.licenseType}

👤 <b>Покупатель:</b> ${purchase.buyerName}
🎹 <b>Продавец:</b> ${purchase.sellerName}

⏰ <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}
`

  return await sendTelegramMessage(message)
}

/**
 * Format and send withdrawal request notification
 */
export async function notifyWithdrawal(withdrawal) {
  const message = `
💸 <b>ЗАПРОС НА ВЫВОД</b>

👤 <b>Пользователь:</b> ${withdrawal.userName}
💰 <b>Сумма:</b> $${withdrawal.amount?.toFixed(2)}
💳 <b>Метод:</b> ${withdrawal.method}
📝 <b>Реквизиты:</b> ${withdrawal.details}

⏰ <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}
`

  return await sendTelegramMessage(message)
}
