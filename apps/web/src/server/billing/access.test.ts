import { describe, expect, it } from "vitest";
import { planAccess, planWith, seatsError } from "./access";

const now = Date.UTC(2026, 10, 26);
const day = 86_400_000;

describe("planAccess", () => {
  it("allows everything during an active trial", () => {
    expect(planAccess({ plan: "trial", planSeats: 5, subscriptionStatus: "trialing", trialEndsAt: new Date(now + 3 * day) }, now)).toEqual({ trial: true, plan: null, seatLimit: null, api: true });
  });
  it("turns the API off once the trial has ended without a plan, without a seat limit", () => {
    expect(planAccess({ plan: "trial", planSeats: 5, subscriptionStatus: "trialing", trialEndsAt: new Date(now - day) }, now)).toEqual({ trial: false, plan: null, seatLimit: null, api: false });
  });
  it("limits seats to what was bought, capped at the plan maximum", () => {
    expect(planAccess({ plan: "basico", planSeats: 2, subscriptionStatus: "active", trialEndsAt: null }, now).seatLimit).toBe(2);
    expect(planAccess({ plan: "basico", planSeats: 10, subscriptionStatus: "active", trialEndsAt: null }, now).seatLimit).toBe(3);
    expect(planAccess({ plan: "profesional", planSeats: 12, subscriptionStatus: "active", trialEndsAt: null }, now).seatLimit).toBe(12);
  });
  it("only includes the API in the plan that sells it", () => {
    expect(planAccess({ plan: "basico", planSeats: 3, subscriptionStatus: "active", trialEndsAt: null }, now).api).toBe(false);
    expect(planAccess({ plan: "profesional", planSeats: 5, subscriptionStatus: "active", trialEndsAt: null }, now).api).toBe(false);
    expect(planAccess({ plan: "empresa", planSeats: 40, subscriptionStatus: "active", trialEndsAt: null }, now).api).toBe(true);
    expect(planWith("api")?.id).toBe("empresa");
  });
});

describe("seatsError", () => {
  it("accepts seats between the current users and the plan maximum", () => {
    expect(seatsError("basico", 3, 2)).toBeNull();
    expect(seatsError("profesional", 15, 15)).toBeNull();
  });
  it("rejects fewer seats than users and more than the plan allows", () => {
    expect(seatsError("profesional", 4, 6)).toMatch(/Ya tienes 6 usuarios/);
    expect(seatsError("basico", 4, 1)).toMatch(/hasta 3 usuarios/);
    expect(seatsError("basico", 0, 0)).toMatch(/válido/);
    expect(seatsError("nada", 3, 1)).toBe("Plan no válido");
  });
});
