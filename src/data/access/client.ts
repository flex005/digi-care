/**
 * The data access layer. PRD §3.1.
 *
 * Every read is promise-shaped, so the day a real API arrives these function
 * bodies change and no component does. No state management library, no
 * data-fetching library, no localStorage — in-memory only, and fixtures reset
 * on reload, which is correct and intended (PRD §3.6).
 */

import type { Organisation, Site, StaffRef } from '../types'
import { organisation, sites, staff } from '../fixtures/organisation'

/** Stand-in for network latency, so Loading is a state we actually see. */
const LATENCY_MS = 120

function resolve<T>(value: T): Promise<T> {
  return new Promise((done) => {
    setTimeout(() => done(value), LATENCY_MS)
  })
}

export function getOrganisation(): Promise<Organisation> {
  return resolve(organisation)
}

export function getSites(): Promise<Site[]> {
  return resolve(sites)
}

export function getStaff(): Promise<StaffRef[]> {
  return resolve(staff)
}
