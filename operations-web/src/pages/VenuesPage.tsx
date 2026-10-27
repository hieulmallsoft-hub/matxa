import React, { useEffect, useState } from 'react';
import { request } from '../api/client';
type Venue = { id: string; name: string; address: string; city: string; rating: number };
export const VenuesPage: React.FC = () => {
  const [items, setItems] = useState<Venue[]>([]);
  const load = () => void request<Venue[]>('/admin/venues').then(setItems).catch(() => setItems([]));
  useEffect(load, []);
  return <div className="space-y-6"><h1 className="text-2xl font-bold">Địa điểm & Spa</h1><div className="bg-white border rounded-2xl divide-y">{items.map(v => <div className="p-4 flex justify-between" key={v.id}><div><b>{v.name}</b><p className="text-sm text-gray-500">{v.address} · {v.city}</p></div><span>{Number(v.rating).toFixed(1)} ★</span></div>)}{!items.length && <p className="p-6 text-gray-500">Chưa có địa điểm.</p>}</div></div>;
};
