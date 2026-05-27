import { describe, it, expect } from 'vitest'
import { isReceiptPathForExpense } from './expense-paths'

describe('isReceiptPathForExpense', () => {
  const id = '11111111-1111-1111-1111-111111111111'

  it('accepts a path that starts with expense/<id>/', () => {
    expect(isReceiptPathForExpense(`expense/${id}/abc.jpg`, id)).toBe(true)
  })

  it('rejects a path for a different expense', () => {
    const other = '22222222-2222-2222-2222-222222222222'
    expect(isReceiptPathForExpense(`expense/${other}/abc.jpg`, id)).toBe(false)
  })

  it('rejects a contribution path', () => {
    expect(isReceiptPathForExpense(`contribution/${id}/abc.jpg`, id)).toBe(false)
  })

  it('rejects a path without the trailing slash separator', () => {
    expect(isReceiptPathForExpense(`expense/${id}-evil/abc.jpg`, id)).toBe(false)
  })

  it('rejects an empty path', () => {
    expect(isReceiptPathForExpense('', id)).toBe(false)
  })
})
