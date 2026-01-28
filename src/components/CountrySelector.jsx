import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import styles from './CountrySelector.module.css'

export default function CountrySelector() {
  const { country, countries, changeCountry, t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredCountries = countries.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (code) => {
    changeCountry(code)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className={styles.selector} ref={dropdownRef}>
      <button 
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('selectCountry')}
      >
        <span className={styles.flag}>{country.flag}</span>
        <span className={styles.code}>{country.code}</span>
        <ChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.open : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <input
            type="text"
            className={styles.search}
            placeholder={t('selectCountry')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className={styles.list}>
            {filteredCountries.map((c) => (
              <button
                key={c.code}
                className={`${styles.option} ${c.code === country.code ? styles.selected : ''}`}
                onClick={() => handleSelect(c.code)}
              >
                <span className={styles.flag}>{c.flag}</span>
                <span className={styles.name}>{c.name}</span>
                {c.code === country.code && <Check size={14} className={styles.check} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
