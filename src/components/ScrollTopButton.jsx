import { useState, useEffect, useCallback } from 'react'
import { ArrowUp } from 'lucide-react'

/**
 * ScrollTopButton — Floating bottom-right quick action
 *
 * Stays subtle/greyed out when at the top or when no table/list is on the page.
 * Becomes active with an accent glow when tables/lists are present and the user
 * scrolls down, allowing quick 1-click return to top.
 */
export default function ScrollTopButton() {
  const [hasContent, setHasContent] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  // Check if current page has tables or data lists
  useEffect(() => {
    const checkContent = () => {
      const found = !!document.querySelector(
        'table, tbody tr, .data-table, .session-table, .inventory-table, [data-scroll-target]'
      )
      setHasContent(found)
    }

    checkContent()
    const observer = new MutationObserver(checkContent)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  // Listen to scroll events on <main>
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    const handleScroll = () => {
      setIsScrolled(main.scrollTop > 100)
    }

    main.addEventListener('scroll', handleScroll, { passive: true })
    return () => main.removeEventListener('scroll', handleScroll)
  }, [])

  const handleScrollTop = useCallback(() => {
    const main = document.querySelector('main')
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const isActive = hasContent && isScrolled

  // If no table/list content exists on the page at all, don't show the button
  if (!hasContent) return null

  return (
    <button
      onClick={handleScrollTop}
      disabled={!isActive}
      className={`scroll-top-fab ${isActive ? 'visible active' : 'subtle'}`}
      aria-label="Scroll to top"
      title={isActive ? "Scroll to top" : "At top of page"}
    >
      <ArrowUp size={16} strokeWidth={2.5} />
    </button>
  )
}
