/**
 * render.js — turns the data in data.js into DOM.
 *
 * Dependency-free: each function returns an HTML string, and mountAll()
 * injects them into the placeholder containers declared in index.html.
 */

import {
  pizzaDeals,
  familyDeals,
  townSupremeDeal,
  specialDeals,
  pizzas,
  specialFlavours,
  extraTopping,
  burgers,
  friedChicken,
  shawarmas,
  burgerDeals,
  specialItems,
  branches,
} from './data.js'

const rs = (n) => (typeof n === 'number' ? `Rs&nbsp;${n.toLocaleString('en-PK')}` : esc(n))

const esc = (str) =>
  String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const listItems = (items) => items.map((i) => `<li>${esc(i)}</li>`).join('')
const digits = (p) => String(p).replace(/\D/g, '')

/* ---------- card builders ---------- */

function dealCard(deal, variant = 'deal') {
  const thumb =
    variant === 'burger'
      ? `<div class="card__thumb" aria-hidden="true"><img src="/images/food/burger.png" alt="" loading="lazy" /></div>`
      : ''
  return `
    <article class="card card--${variant} reveal-card" tabindex="0">
      <div class="card__glow" aria-hidden="true"></div>
      ${thumb}
      <header class="card__head">
        <h3 class="card__name">${esc(deal.name)}</h3>
        ${deal.tag ? `<span class="card__tag">${esc(deal.tag)}</span>` : ''}
      </header>
      <ul class="card__list">${listItems(deal.items)}</ul>
      <footer class="card__foot">
        <span class="card__price">${rs(deal.price)}</span>
        <a class="card__order" href="#order">Order</a>
      </footer>
    </article>`
}

function supremeCard(deal) {
  return `
    <article class="supreme reveal-card" tabindex="0">
      <div class="supreme__glow" aria-hidden="true"></div>
      <div class="supreme__body">
        <p class="eyebrow">Feed the whole crew</p>
        <h3 class="supreme__name">${esc(deal.name)}</h3>
        <ul class="supreme__list">${listItems(deal.items)}</ul>
      </div>
      <div class="supreme__aside">
        <span class="supreme__price">${rs(deal.price)}</span>
        <a class="btn btn--gold" href="#order">Order this feast</a>
      </div>
    </article>`
}

const SIZES = ['R', 'M', 'L', 'EL']

function pizzaRow(pizza) {
  const cells = SIZES.map(
    (k) =>
      `<div><dt>${k}</dt><dd>${pizza.size[k] != null ? rs(pizza.size[k]) : '<span class="muted">—</span>'}</dd></div>`,
  ).join('')
  return `
    <article class="pizza-row reveal-card" data-category="${esc(pizza.category || 'special')}" tabindex="0">
      <div class="pizza-row__main">
        <h3 class="pizza-row__name">
          ${esc(pizza.name)} ${pizza.hot ? '<span class="pizza-row__hot" aria-label="Bestseller">🔥</span>' : ''}
        </h3>
        <p class="pizza-row__desc">${esc(pizza.desc)}</p>
      </div>
      <dl class="pizza-row__sizes" aria-label="Sizes and prices">${cells}</dl>
    </article>`
}

function splitMenu(group) {
  const rows = group.items
    .map(
      (i) => `
      <li class="split-menu__row">
        <span>${esc(i.name)}</span>
        <span class="split-menu__price">${rs(i.price)}</span>
      </li>`,
    )
    .join('')
  return `
    <div class="split-menu reveal-card">
      <h3 class="split-menu__title">${esc(group.title)}</h3>
      <ul class="split-menu__list">${rows}</ul>
    </div>`
}

function branchCard(branch, index) {
  const wa = '92' + digits(branch.phones[0]).replace(/^0/, '')
  const calls = branch.phones
    .map((p) => `<a class="branch-card__call" href="tel:${digits(p)}">${esc(p)}</a>`)
    .join('')
  return `
    <article class="branch-card reveal-card">
      <div class="branch-card__no" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>
      <h3 class="branch-card__name">
        ${esc(branch.name)}${branch.isNew ? '<span class="branch-card__new">New</span>' : ''}
      </h3>
      <p class="branch-card__area">${esc(branch.area)}</p>
      <div class="branch-card__phones">${calls}</div>
      <a class="branch-card__wa" href="https://wa.me/${wa}" target="_blank" rel="noreferrer">WhatsApp to order</a>
    </article>`
}

/* ---------- mount ---------- */

function fill(id, html) {
  const el = document.getElementById(id)
  if (el) el.innerHTML = html
}

export function mountAll() {
  fill('pizzaDeals', pizzaDeals.map((d) => dealCard(d, 'deal')).join(''))
  fill('familyDeals', familyDeals.map((d) => dealCard(d, 'family')).join(''))
  fill('supremeDeal', supremeCard(townSupremeDeal))
  fill('specialDeals', specialDeals.map((d) => dealCard(d, 'special')).join(''))

  fill('pizzaList', pizzas.map(pizzaRow).join(''))
  fill('specialFlavoursList', specialFlavours.map(pizzaRow).join(''))
  fill(
    'extraTopping',
    SIZES.map((k) => `<span><strong>${k}</strong> ${rs(extraTopping[k])}</span>`).join(''),
  )

  fill(
    'sideMenus',
    [
      splitMenu({ title: 'Burgers', items: burgers }),
      splitMenu({ title: 'Fried Chicken', items: friedChicken }),
      splitMenu({ title: 'Shawarmas & Rolls', items: shawarmas }),
    ].join(''),
  )
  fill('burgerDeals', burgerDeals.map((d) => dealCard(d, 'burger')).join(''))

  fill('specialItemsGrid', specialItems.map(splitMenu).join(''))
  fill('branchesGrid', branches.map(branchCard).join(''))

  const year = document.getElementById('year')
  if (year) year.textContent = new Date().getFullYear()
}
