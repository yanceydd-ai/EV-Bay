"use client";

import { useActionState } from "react";
import { createSubscription } from "@/lib/actions";

export function SubscribeForm() {
  const [state, action, pending] = useActionState(createSubscription, null);

  return (
    <form className="form" action={action}>
      <label>
        Email
        <input name="email" type="email" placeholder="driver@example.com" />
      </label>
      <label>
        Phone
        <input name="phone" type="tel" placeholder="+15551234567" />
      </label>
      <div className="check-row">
        <label>
          <input name="notifyEmail" type="checkbox" defaultChecked />
          Email
        </label>
        <label>
          <input name="notifySms" type="checkbox" />
          SMS
        </label>
      </div>
      <label>
        Notify when at least
        <select name="minOpenBays" defaultValue="1">
          <option value="1">1 bay is open</option>
          <option value="2">2 bays are open</option>
          <option value="3">3 bays are open</option>
          <option value="4">4 bays are open</option>
        </select>
      </label>
      <button className="button" disabled={pending} type="submit">
        {pending ? "Signing up..." : "Sign up"}
      </button>
      {state?.message ? <p className={state.ok ? "" : "muted"}>{state.message}</p> : null}
    </form>
  );
}

