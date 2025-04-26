"use client"

import * as React from "react"

const TabsContext = React.createContext(null)

function Tabs({ defaultValue, ...props }) {
  const [value, setValue] = React.useState(defaultValue)

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div {...props} />
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }) {
  return (
    <div
      className={`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground bg-gray-100 ${className}`}
      {...props}
    />
  )
}

function TabsTrigger({ value, className, disabled, ...props }) {
  const context = React.useContext(TabsContext)
  const isActive = context.value === value

  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm ${
        isActive ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
      } ${className}`}
      onClick={() => context.setValue(value)}
      disabled={disabled}
      data-state={isActive ? "active" : "inactive"}
      {...props}
    />
  )
}

function TabsContent({ value, className, ...props }) {
  const context = React.useContext(TabsContext)
  const isActive = context.value === value

  if (!isActive) return null

  return (
    <div
      className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
      data-state={isActive ? "active" : "inactive"}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
