'use client'

import Link from 'next/link'
import Image from 'next/image'
import styles from './AppHeader.module.css'
import AccountMenu from './AccountMenu'

export default function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Go to homepage">
          <Image src="/echostone_logo.png" alt="EchoStone" width={36} height={36} className={styles.brandLogo} />
          <span className={styles.brandName}>EchoStone</span>
        </Link>
        <AccountMenu />
      </div>
    </header>
  )
}


