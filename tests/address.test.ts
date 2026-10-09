import { describe, expect, test } from "bun:test"
import { validAddress } from "../mobile/src/connection/address"

const token = "0123456789abcdef0123456789abcdef"

describe("direcciones de emparejamiento", () => {
  test.each(["10.0.0.1", "172.16.1.2", "172.31.255.254", "192.168.1.20", "127.0.0.1"])(
    "acepta %s",
    (host) => {
      expect(validAddress(`ws://${host}:47917/ws?token=${token}`)).toBe(true)
    },
  )

  test.each([
    `ws://8.8.8.8:47917/ws?token=${token}`,
    `ws://172.32.0.1:47917/ws?token=${token}`,
    `wss://192.168.1.2:47917/ws?token=${token}`,
    `ws://192.168.1.2:47918/ws?token=${token}`,
    `ws://192.168.1.2:47917/other?token=${token}`,
    "ws://192.168.1.2:47917/ws?token=short",
    "not a URL",
  ])("rechaza %s", (address) => {
    expect(validAddress(address)).toBe(false)
  })
})
