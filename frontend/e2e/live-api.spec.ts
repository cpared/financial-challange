import { expect, test } from '@playwright/test'

test('reads portfolio and instrument results from the live backend', async ({
  page,
}) => {
  await page.goto('/portfolio')
  await page.getByLabel('Cuenta API').fill('2')
  await page.getByLabel('Cuenta API').press('Enter')

  await expect(page.getByText('Todavía no hay posiciones')).toBeVisible()

  await page.getByRole('link', { name: 'Instrumentos' }).click()
  await page.getByLabel('Ticker o nombre').fill('BB')
  await page.getByRole('button', { name: 'Buscar' }).click()

  await expect(page.getByText('BBAR')).toBeVisible()
})

test('sends order creation and cancellation requests to the live backend', async ({
  page,
}) => {
  await page.goto('/orders')
  const accountInput = page.getByLabel('Cuenta API')
  await accountInput.fill('999999')
  await accountInput.press('Enter')

  await page.getByLabel('Instrumento').fill('BB')
  await page.getByRole('button', { name: /BBAR/ }).click()
  await page.getByRole('button', { name: 'Enviar orden al backend' }).click()

  const createError = page.getByRole('heading', {
    name: 'El backend rechazó la solicitud',
  }).locator('..')
  await expect(createError).toContainText('User 999999 was not found.')

  await page.getByLabel('ID de orden').fill('999999')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()

  const cancelError = page.getByRole('heading', {
    name: 'No se pudo cancelar la orden',
  }).locator('..')
  await expect(cancelError).toContainText('User 999999 was not found.')
})
