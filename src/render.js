/**
 * render.js — turns the data in data.js into DOM.
 *
 * Kept intentionally dependency-free (no framework): each function returns an
 * HTML string, and mountAll() injects them into the placeholder containers
 * declared in index.html. Text is escaped before insertion.
 */

import {
  pizzaDeals,
  familyDeals,
  specialDeals,
  pizzas,
  premiumPizzas,
  sideMenus,
  burgerDeals,
  sides,
  branches,
} from './data.js'

const rs = (n) => `Rs&nbsp;${n.toLocaleString('en-PK')}`

const esc = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const listItems = (items) =>
  items.map((i) => `<li>${esc(i)}</li>`).join('')

/* ---------- card builders ---------- */

function dealCard(deal, variant = 'deal') {
  return `
    <article class="card card--${variant} reveal-card" tabindex="0">
      <div class="card__glow" aria-hidden="true"></div>
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

function premiumCard(pizza) {
  return `
    <article class="premium__card reveal-card" tabindex="0">
      <div class="premium__disc" aria-hidden="true">
        <span class="premium__slice"></span>
      </div>
      <div class="premium__body">
        <h3>${esc(pizza.name)}</h3>
        <p>${esc(pizza.desc)}</p>
        <div class="premium__foot">
          <span class="card__price">${rs(pizza.price)}</span>
          <a class="btn btn--gold btn--sm" href="#order">Add to order</a>
        </div>
      </div>
    </article>`
}

function pizzaRow(pizza) {
  const { R, M, L, EL } = pizza.size
  return `
    <article class="pizza-row reveal-card" data-category="${esc(pizza.category)}" tabindex="0">
      <div class="pizza-row__main">
        <h3 class="pizza-row__name">
          ${esc(pizza.name)} ${pizza.hot ? '<span class="pizza-row__hot" aria-label="Bestseller">🔥</span>' : ''}
        </h3>
        <p class="pizza-row__desc">${esc(pizza.desc)}</p>
      </div>
      <dl class="pizza-row__sizes" aria-label="Sizes and prices">
        <div><dt>R</dt><dd>${rs(R)}</dd></div>
        <div><dt>M</dt><dd>${rs(M)}</dd></div>
        <div><dt>L</dt><dd>${rs(L)}</dd></div>
        <div><dt>EL</dt><dd>${rs(EL)}</dd></div>
      </dl>
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

function sideCard(item) {
  return `
    <article class="side-card reveal-card" tabindex="0">
      <span class="side-card__kind">${esc(item.kind)}</span>
      <h3 class="side-card__name">${esc(item.name)}</h3>
      <span class="card__price">${rs(item.price)}</span>
    </article>`
}

function branchCard(branch, index) {
  return `
    <article class="branch-card reveal-card">
      <div class="branch-card__no" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>
      <h3 class="branch-card__name">${esc(branch.name)}</h3>
      <div class="branch-card__actions">
        <a class="branch-card__call" href="tel:${esc(branch.phone)}">
          <span aria-hidden="true">📞</span> ${esc(branch.phone)}
        </a>
        <a class="branch-card__wa" href="https://wa.me/${esc(branch.whatsapp)}" target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </div>
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
  fill('specialDeals', specialDeals.map((d) => dealCard(d, 'special')).join(''))
  fill('pizzaList', pizzas.map(pizzaRow).join(''))
  fill('premiumPizzas', premiumPizzas.map(premiumCard).join(''))
  fill('sideMenus', sideMenus.map(splitMenu).join(''))
  fill('burgerDeals', burgerDeals.map((d) => dealCard(d, 'burger')).join(''))
  fill('sidesGrid', sides.map(sideCard).join(''))
  fill('branchesGrid', branches.map(branchCard).join(''))

  const year = document.getElementById('year')
  if (year) year.textContent = new Date().getFullYear()
}
