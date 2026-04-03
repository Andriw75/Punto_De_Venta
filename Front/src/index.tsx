/* @refresh reload */
import { render } from 'solid-js/web'
import App from './application/App'
import ToastContainer from './application/common/UI/Toast/ToastContainer'
import { ConfirmContainer } from './application/common/UI/Confirm/confirmStore'
import { AuthProvider } from './application/context/auth'
import "./index.css"

const root = document.getElementById('root')

render(() =>
    <>
        <AuthProvider>
            <ToastContainer />
            <App />
            <ConfirmContainer />
        </AuthProvider>
    </>
    , root!)
