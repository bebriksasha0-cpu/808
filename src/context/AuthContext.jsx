import { createContext, useContext, useState, useEffect } from 'react'
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  linkWithCredential,
  reload
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

const AuthContext = createContext()

// Check if username is taken
const isUsernameTaken = async (name, excludeUserId = null) => {
  const normalizedName = name.trim().toLowerCase()
  if (!normalizedName) return false
  
  const usersQuery = query(collection(db, 'users'))
  const snapshot = await getDocs(usersQuery)
  
  for (const doc of snapshot.docs) {
    if (excludeUserId && doc.id === excludeUserId) continue
    const userData = doc.data()
    if (userData.name?.toLowerCase() === normalizedName) {
      return true
    }
  }
  return false
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Admin usernames (can add more)
  const ADMIN_USERS = ['L', 'l']

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get additional user data from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            const isAdmin = ADMIN_USERS.includes(userData.name)
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email,
              emailVerified: firebaseUser.emailVerified,
              isAdmin,
              ...userData
            })
            
            // Update last seen for online tracking
            await updateDoc(doc(db, 'users', firebaseUser.uid), {
              lastSeen: serverTimestamp(),
              isOnline: true
            })
          } else {
            // Create user document if doesn't exist
            const userData = {
              name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              email: firebaseUser.email,
              avatar: firebaseUser.photoURL || null,
              createdAt: serverTimestamp(),
              lastNameChange: null
            }
            await setDoc(doc(db, 'users', firebaseUser.uid), userData)
            setUser({
              id: firebaseUser.uid,
              emailVerified: firebaseUser.emailVerified,
              ...userData
            })
          }
        } catch (err) {
          console.error('Error fetching user data:', err)
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            emailVerified: firebaseUser.emailVerified
          })
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Update lastSeen periodically and on page visibility change
  useEffect(() => {
    if (!user?.id) return

    const updateLastSeen = async () => {
      try {
        await updateDoc(doc(db, 'users', user.id), {
          lastSeen: serverTimestamp(),
          isOnline: true
        })
      } catch (err) {
        console.error('Error updating lastSeen:', err)
      }
    }

    // Update every 2 minutes
    const interval = setInterval(updateLastSeen, 2 * 60 * 1000)

    // Update on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateLastSeen()
      } else {
        // Mark as offline when tab is hidden
        updateDoc(doc(db, 'users', user.id), {
          lastSeen: serverTimestamp(),
          isOnline: false
        }).catch(() => {})
      }
    }

    // Update on beforeunload
    const handleBeforeUnload = () => {
      navigator.sendBeacon && updateDoc(doc(db, 'users', user.id), {
        isOnline: false,
        lastSeen: serverTimestamp()
      }).catch(() => {})
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [user?.id])

  // Register with email and password
  const register = async ({ email, password, name }) => {
    try {
      setError(null)
      
      // Check if username is taken
      if (name && await isUsernameTaken(name)) {
        return { success: false, error: 'This username is already taken' }
      }
      
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password)
      
      // Send verification email
      await sendEmailVerification(firebaseUser)
      
      // Create user document in Firestore
      const userData = {
        name: name || email.split('@')[0],
        email: email,
        avatar: null,
        createdAt: serverTimestamp(),
        lastNameChange: null
      }
      await setDoc(doc(db, 'users', firebaseUser.uid), userData)
      
      return { success: true, message: 'Verification email sent! Please check your inbox.' }
    } catch (err) {
      console.error('Registration error:', err)
      setError(err.message)
      return { success: false, error: getErrorMessage(err.code) }
    }
  }

  // Login with email and password
  const login = async ({ email, password }) => {
    try {
      setError(null)
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password)
      
      if (!firebaseUser.emailVerified) {
        return { 
          success: false, 
          error: 'Please verify your email first. Check your inbox.',
          needsVerification: true
        }
      }
      
      return { success: true }
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message)
      return { success: false, error: getErrorMessage(err.code) }
    }
  }

  // Login with Google
  const loginWithGoogle = async () => {
    try {
      setError(null)
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      
      // Check if this is a new user (first time sign in)
      const isNewUser = result._tokenResponse?.isNewUser || false
      
      return { success: true, isNewUser }
    } catch (err) {
      console.error('Google login error:', err)
      setError(err.message)
      return { success: false, error: getErrorMessage(err.code) }
    }
  }

  // Link password to Google account
  const linkPassword = async (password) => {
    try {
      if (!auth.currentUser || !auth.currentUser.email) {
        return { success: false, error: 'No user logged in' }
      }
      
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        password
      )
      
      await linkWithCredential(auth.currentUser, credential)
      return { success: true }
    } catch (err) {
      console.error('Link password error:', err)
      // If already linked, just return success
      if (err.code === 'auth/provider-already-linked') {
        return { success: true }
      }
      return { success: false, error: getErrorMessage(err.code) }
    }
  }

  // Resend verification email
  const resendVerificationEmail = async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser)
        return { success: true, message: 'Verification email sent!' }
      }
      return { success: false, error: 'No user logged in' }
    } catch (err) {
      return { success: false, error: getErrorMessage(err.code) }
    }
  }

  // Check if email is verified (for polling)
  const checkEmailVerified = async () => {
    try {
      if (auth.currentUser) {
        await reload(auth.currentUser)
        if (auth.currentUser.emailVerified) {
          // Update user state with verified status
          setUser(prev => prev ? { ...prev, emailVerified: true } : null)
          return { verified: true }
        }
      }
      return { verified: false }
    } catch (err) {
      console.error('Error checking verification:', err)
      return { verified: false }
    }
  }

  // Logout
  const logout = async () => {
    try {
      await signOut(auth)
      setUser(null)
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  // Update profile
  const updateProfile = async ({ name, avatar, telegram }) => {
    if (!user) return { success: false, error: 'Not logged in' }
    
    try {
      const updates = {}
      const now = new Date()
      
      // Check if trying to change name
      if (name && name !== user.name) {
        // Check if username is taken
        if (await isUsernameTaken(name, user.id)) {
          return { success: false, error: 'This username is already taken' }
        }
        
        if (user.lastNameChange) {
          const lastChange = new Date(user.lastNameChange.seconds ? user.lastNameChange.seconds * 1000 : user.lastNameChange)
          const daysSinceChange = (now - lastChange) / (1000 * 60 * 60 * 24)
          
          if (daysSinceChange < 7) {
            const daysLeft = Math.ceil(7 - daysSinceChange)
            return { success: false, error: `You can change your name in ${daysLeft} days` }
          }
        }
        updates.name = name
        updates.lastNameChange = serverTimestamp()
      }
      
      if (avatar !== undefined) {
        updates.avatar = avatar
      }
      
      if (telegram !== undefined) {
        updates.telegram = telegram
      }
      
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', user.id), updates)
        setUser(prev => ({ 
          ...prev, 
          ...updates,
          lastNameChange: updates.lastNameChange ? now.toISOString() : prev.lastNameChange
        }))
      }
      
      return { success: true }
    } catch (err) {
      console.error('Update profile error:', err)
      return { success: false, error: err.message }
    }
  }

  // Check if can change name
  const canChangeName = () => {
    if (!user || !user.lastNameChange) return { canChange: true, daysLeft: 0 }
    
    const now = new Date()
    const lastChange = new Date(user.lastNameChange.seconds ? user.lastNameChange.seconds * 1000 : user.lastNameChange)
    const daysSinceChange = (now - lastChange) / (1000 * 60 * 60 * 24)
    
    if (daysSinceChange >= 7) {
      return { canChange: true, daysLeft: 0 }
    }
    
    return { canChange: false, daysLeft: Math.ceil(7 - daysSinceChange) }
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      error,
      login, 
      logout, 
      register, 
      loginWithGoogle,
      linkPassword,
      resendVerificationEmail,
      checkEmailVerified,
      updateProfile, 
      canChangeName 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// Helper function to get user-friendly error messages
function getErrorMessage(code) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered'
    case 'auth/invalid-email':
      return 'Invalid email address'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters'
    case 'auth/user-not-found':
      return 'No account found with this email'
    case 'auth/wrong-password':
      return 'Incorrect password'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later'
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed'
    default:
      return 'An error occurred. Please try again'
  }
}
