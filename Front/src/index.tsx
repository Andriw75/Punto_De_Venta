/* @refresh reload */
import { render } from 'solid-js/web'
import App from './application/App'
import ToastContainer from './application/common/UI/Toast/ToastContainer'
import { ConfirmContainer } from './application/common/UI/Confirm/confirmStore'
import { AuthProvider } from './application/context/auth'
import "./index.css"
import { RealtimeBridge } from './application/context/RealtimeBridge'
import { WebSocketProvider } from './application/context/web_socket'

const root = document.getElementById('root')

render(() =>
    <>
        <WebSocketProvider>
            <AuthProvider>
                <RealtimeBridge />
                <ToastContainer />
                <App />
                <ConfirmContainer />
            </AuthProvider>
        </WebSocketProvider>
    </>
    , root!)
