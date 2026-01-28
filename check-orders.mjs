// Debug script to check orders in Firebase
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBmj_hj8PNRZ6DkOMwMEMihKP1maG1E4TY",
  authDomain: "suport-85395.firebaseapp.com",
  projectId: "suport-85395",
  storageBucket: "suport-85395.firebasestorage.app",
  messagingSenderId: "427740197498",
  appId: "1:427740197498:web:67f1e37d75420bde50f498"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function checkOrders() {
  console.log('Checking orders collection...\n')
  
  try {
    const ordersSnapshot = await getDocs(collection(db, 'orders'))
    console.log(`Total orders found: ${ordersSnapshot.docs.length}\n`)
    
    ordersSnapshot.docs.forEach((doc, index) => {
      const data = doc.data()
      console.log(`--- Order ${index + 1} ---`)
      console.log(`ID: ${doc.id}`)
      console.log(`OrderRef: ${data.orderRef}`)
      console.log(`BuyerId: ${data.buyerId}`)
      console.log(`BuyerName: ${data.buyerName}`)
      console.log(`BeatTitle: ${data.beatTitle}`)
      console.log(`Status: ${data.status}`)
      console.log('')
    })
  } catch (err) {
    console.error('Error:', err.message)
  }
  
  process.exit(0)
}

checkOrders()
