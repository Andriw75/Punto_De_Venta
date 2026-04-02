import tkinter as tk
import webbrowser
from server import start_server, stop_server

class App:
    def __init__(self, root):
        self.root = root
        root.title("POS Servidor")
        root.geometry("400x220")
        root.configure(bg="#f0f0f0")

        # Fuente y colores
        self.font_label = ("Helvetica", 12)
        self.font_button = ("Helvetica", 10, "bold")
        self.bg_start = "#4CAF50"
        self.bg_stop = "#f44336"
        self.bg_exit = "#607D8B"

        # Estado del servidor
        self.status_label = tk.Label(root, text="Servidor detenido", bg="#f0f0f0",
                                     font=self.font_label, fg="red")
        self.status_label.pack(pady=15)

        # Frame para botones
        btn_frame = tk.Frame(root, bg="#f0f0f0")
        btn_frame.pack(pady=10)

        # Botones
        self.start_button = tk.Button(btn_frame, text="Iniciar Servidor", font=self.font_button,
                                      bg=self.bg_start, fg="white", width=15, command=self.start)
        self.start_button.grid(row=0, column=0, padx=5, pady=5)
        self.add_hover(self.start_button, hover_color="#45a049")

        self.stop_button = tk.Button(btn_frame, text="Detener Servidor", font=self.font_button,
                                     bg=self.bg_stop, fg="white", width=15, command=self.stop, state="disabled")
        self.stop_button.grid(row=0, column=1, padx=5, pady=5)
        self.add_hover(self.stop_button, hover_color="#e53935")

        self.exit_button = tk.Button(root, text="Salir", font=self.font_button,
                                     bg=self.bg_exit, fg="white", width=35, command=root.quit)
        self.exit_button.pack(pady=10)
        self.add_hover(self.exit_button, hover_color="#546E7A")

    def add_hover(self, widget, hover_color=None):
        original_bg = widget.cget("bg")
        hover_color = hover_color or "#3e8e41"
        widget.bind("<Enter>", lambda e: widget.config(bg=hover_color))
        widget.bind("<Leave>", lambda e: widget.config(bg=original_bg))

    def start(self):
        url = start_server()
        if url:
            self.status_label.config(
                text=f"Servidor corriendo en {url}",
                fg="blue",
                cursor="hand2"
            )

            self.status_label.bind(
                "<Button-1>",
                lambda e: webbrowser.open(url)
            )

            self.start_button.config(state="disabled")
            self.stop_button.config(state="normal")

    def stop(self):
        stop_server()
        self.status_label.config(text="Servidor detenido", fg="red", cursor="")
        self.status_label.unbind("<Button-1>")
        # Actualizar botones
        self.start_button.config(state="normal")
        self.stop_button.config(state="disabled")

root = tk.Tk()
app = App(root)
root.mainloop()


