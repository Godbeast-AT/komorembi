import os
import time

import requests
import streamlit as st


API_BASE = os.getenv("AI_AGENCY_API_BASE", "http://localhost:8000").rstrip("/")

st.set_page_config(page_title="AI Agency", layout="wide")
st.title("AI Agency")
st.caption("Generate a brand-aligned content kit + branded PDF.")

col1, col2, col3 = st.columns(3)
with col1:
    if st.button("Starter $29", use_container_width=True):
        st.session_state["tier"] = "starter"
with col2:
    if st.button("Professional $99", use_container_width=True):
        st.session_state["tier"] = "professional"
with col3:
    if st.button("Enterprise $299", use_container_width=True):
        st.session_state["tier"] = "enterprise"

tier = st.session_state.get("tier", "professional")

client_name = st.text_input("Client / Brand name (optional)")
brief = st.text_area(
    "Project brief",
    height=220,
    placeholder="Example: Create marketing materials for a Delhi coffee roastery focused on single-origin beans...",
)

run = st.button("Generate project", type="primary", use_container_width=True)

if run:
    if not brief.strip():
        st.error("Please enter a brief.")
    else:
        resp = requests.post(
            f"{API_BASE}/api/v1/projects",
            json={"brief": brief, "tier": tier, "client_name": client_name or None},
            timeout=30,
        )
        if resp.status_code != 200:
            st.error(f"API error: {resp.status_code} {resp.text}")
        else:
            data = resp.json()
            st.session_state["project_id"] = data["project_id"]
            st.session_state["checkout_url"] = data.get("stripe_checkout_url")

project_id = st.session_state.get("project_id")
if project_id:
    st.divider()
    st.subheader("Project status")
    st.write(f"Project ID: `{project_id}`")

    checkout_url = st.session_state.get("checkout_url")
    if checkout_url:
        st.link_button("Open Stripe checkout", checkout_url, use_container_width=True)
    else:
        st.info("Stripe is disabled (or not configured). Generation is running immediately.")

    status_box = st.empty()
    kit_box = st.empty()
    download_box = st.empty()

    for _ in range(120):  # up to ~4 minutes
        r = requests.get(f"{API_BASE}/api/v1/projects/{project_id}", timeout=15)
        if r.status_code != 200:
            status_box.error(f"Status error: {r.status_code} {r.text}")
            break

        s = r.json()
        status_box.write(f"Status: **{s['status']}**")
        if s.get("error"):
            status_box.error(s["error"])
            break

        if s["status"] == "ready":
            kit = s.get("brand_kit") or {}
            kit_box.json(kit)
            download_url = s.get("download_url")
            if download_url:
                download_box.link_button("Download PDF", download_url, use_container_width=True)
            break

        time.sleep(2)

