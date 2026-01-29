import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import styles from './CountrySelector.module.css'

export default function CountrySelector() {
  const { country, countries, changeCountry } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const handleSelect = (code) => {
    changeCountry(code)
    setIsOpen(false)
  }

  return (
    <div className={styles.selector} ref={dropdownRef}>
      <button 
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className={styles.flag}>{country.flag}</span>
        <span className={styles.code}>{country.code}</span>
        <ChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.open : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {countries.map((c) => (
            <button
              key={c.code}
              type="button"
              className={`${styles.option} ${c.code === country.code ? styles.selected : ''}`}
              onClick={() => handleSelect(c.code)}
            >
              <span className={styles.flag}>{c.flag}</span>
              <span className={styles.name}>{c.name}</span>
              {c.code === country.code && <Check size={16} className={styles.check} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
