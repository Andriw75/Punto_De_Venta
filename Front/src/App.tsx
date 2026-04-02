import { createSignal } from 'solid-js'

function App() {
  const [count, setCount] = createSignal(0)

  return (
    <>

      <button class="counter" onClick={() => setCount((count) => count + 1)}>
        Count is {count()}
      </button>
    </>

  )
}

export default App
