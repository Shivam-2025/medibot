import React, { useState } from 'react'
import Home from './pages/Home'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <Home />
    </div>
  )
}
