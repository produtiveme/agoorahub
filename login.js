document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DO DOM ---
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const errorMessage = document.getElementById('error-message');

    // API_URLS e setCache vêm de common.js

    /**
     * Lida com a submissão do formulário de login.
     * @param {Event} e - O evento de submissão do formulário.
     */
    async function handleLogin(e) {
        e.preventDefault(); // Impede o recarregamento da página
        
        const email = emailInput.value;
        const password = passwordInput.value;

        // Desabilita o botão e mostra "carregando"
        loginBtn.disabled = true;
        loginBtn.textContent = 'Aguarde...';
        errorMessage.classList.add('is-hidden');
        errorMessage.textContent = '';

        try {
            const response = await fetch(API_URLS.LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
            });

            const data = await response.json();

            if (!response.ok) {
                // Pega a mensagem de erro do N8N (ex: "Email ou senha incorretos.")
                throw new Error(data.message || 'Erro ao tentar fazer login.');
            }

            // Sucesso!
            if (data.token) {
                // Salva o token no sessionStorage
                setCache('authToken', data.token);
                // Redireciona para o painel principal
                window.location.href = 'os.html';
            } else {
                throw new Error('Token não recebido do servidor.');
            }

        } catch (error) {
            // Mostra o erro na tela
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('is-hidden');
            
            // Reabilita o botão
            loginBtn.disabled = false;
            loginBtn.textContent = 'Entrar';
        }
    }

    // Adiciona o listener ao formulário
    loginForm.addEventListener('submit', handleLogin);
});