import React, { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./api";
import type { Goal } from "./types";

export default function GoalsView({ token, goals, setGoals }: { token: string; goals: Goal[]; setGoals: (goals: Goal[]) => void }) {
  const goalData = useMemo(() => goals.map((g) => ({ name: g.title, current: g.current, target: g.target })), [goals]);
  const addGoal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const payload = { title: String(fd.get("title")), target: Number(fd.get("target")), current: Number(fd.get("current")), unit: String(fd.get("unit") || "RUB"), deadline: String(fd.get("deadline") || "") };
    setGoals([await api<Goal>("/goals", token, { method: "POST", body: JSON.stringify(payload) }), ...goals]);
    event.currentTarget.reset();
  };
  return <section className="goals"><form onSubmit={addGoal}><input name="title" placeholder="Цель" required/><input name="target" type="number" placeholder="Нужно" required/><input name="current" type="number" placeholder="Есть" required/><input name="unit" placeholder="RUB"/><input name="deadline" type="date"/><button>Добавить</button></form><ResponsiveContainer height={320}><AreaChart data={goalData}><XAxis dataKey="name" stroke="#bcbcbc"/><YAxis stroke="#bcbcbc"/><Tooltip contentStyle={{ background: "#1e1e1e", border: "0", borderRadius: 8, boxShadow: "rgba(255, 255, 255, 0.1) 0 0 0 1px inset", color: "#eeeeee" }}/><Area dataKey="target" stroke="#7c3aed" fill="#7c3aed33"/><Area dataKey="current" stroke="#a78bfa" fill="#a78bfa26"/></AreaChart></ResponsiveContainer>{goals.map((g) => <div className="goal" key={g.id}><b>{g.title}</b><span>{g.current} / {g.target} {g.unit}</span><button onClick={async () => { await api(`/goals/${g.id}`, token, { method: "DELETE" }); setGoals(goals.filter((x) => x.id !== g.id)); }}><Trash2 size={16}/></button></div>)}</section>;
}
