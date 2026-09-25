export async function send(url: string, method: string, csrfToken: string, body: unknown) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(response.status === 409 ? 'Данные изменились. Обновите страницу.' : 'Не удалось сохранить.')
  return response.json()
}
