/*
  Este arquivo concentra TODAS as chamadas HTTP relacionadas a autenticação.
  Assim, quando o endpoint mudar, só é preciso mexer aqui — o resto do app
  (páginas, contexto) não precisa saber como a comunicação acontece.

  Formato baseado num backend FastAPI com OAuth2 + JWT (access token +
  refresh token), como o projeto de referência que você vai usar de base.
  Se o endpoint final for diferente, ajuste só as URLs e formatos abaixo.

  --------------------------------------------------------------------
  Contrato esperado do backend:

  POST {API_URL}/token   (login)
    Content-Type: application/x-www-form-urlencoded   <- não é JSON!
    body: username=...&password=...
    resposta 200: { access_token, refresh_token, token_type }
    resposta 401: { detail: "Incorrect username or password" }

  POST {API_URL}/user/   (cadastro)
    Content-Type: application/json
    body: { username, email, password }
    resposta 201: { username, avatar, bio }
    resposta 409/400: { detail: "mensagem de erro" }

  GET {API_URL}/user/{username}/   (dados do usuário logado)
    header: Authorization: Bearer {access_token}
    resposta 200: { username, avatar, bio }
  --------------------------------------------------------------------
*/

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function tratarResposta(resposta) {
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    // FastAPI costuma devolver o erro em "detail"
    throw new Error(dados.detail || dados.mensagem || "Não foi possível completar a solicitação.");
  }
  return dados;
}

// O endpoint /token do FastAPI (OAuth2PasswordRequestForm) espera
// dados de formulário, não JSON — por isso usamos URLSearchParams aqui.
export async function login({ username, password }) {
  const corpo = new URLSearchParams();
  corpo.append("username", username);
  corpo.append("password", password);

  const resposta = await fetch(`${API_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo,
  });
  return tratarResposta(resposta); // { access_token, refresh_token, token_type }
}

export async function cadastrar({ username, email, password }) {
  const resposta = await fetch(`${API_URL}/user/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  return tratarResposta(resposta); // { username, avatar, bio }
}

export async function buscarUsuarioLogado({ username, token }) {
  const resposta = await fetch(`${API_URL}/user/${username}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return tratarResposta(resposta); // { username, avatar, bio }
}
