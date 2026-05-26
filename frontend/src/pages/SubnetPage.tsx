import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

const EXAMPLES = ['192.168.1.0/24', '10.0.0.0/8', '172.16.0.0/12', '10.10.10.0/28', '192.168.0.0/16']

export default function SubnetPage() {
  const [cidr, setCidr] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!cidr.trim()) { setError('Please enter a CIDR notation.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/subnet/calculate', { cidr })
      if (data.status === 'success') {
        const d = data.data
        setResult([
          `CIDR:              ${d.cidr}`,
          `Network Address:   ${d.network_address}`,
          `Broadcast Address: ${d.broadcast_address}`,
          `Subnet Mask:       ${d.subnet_mask}`,
          `Wildcard Mask:     ${d.wildcard_mask}`,
          `Prefix Length:     /${d.prefix_length}`,
          ``,
          `Total Addresses:   ${d.total_addresses.toLocaleString()}`,
          `Usable Hosts:      ${d.usable_hosts.toLocaleString()}`,
          `First Host:        ${d.first_host}`,
          `Last Host:         ${d.last_host}`,
          ``,
          `IP Class:          Class ${d.ip_class}`,
          `Private Range:     ${d.is_private ? 'Yes ✅' : 'No'}`,
          `Loopback:          ${d.is_loopback ? 'Yes' : 'No'}`,
        ].join('\n'))
      } else {
        setError(data.data?.message ?? 'Calculation failed')
      }
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🌐" title="IP Subnet Calculator" description="Calculate network details from CIDR notation — usable hosts, ranges, masks, and IP class." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="cidr" className="label">CIDR Notation</label>
            <input id="cidr" type="text" value={cidr} onChange={e => setCidr(e.target.value)}
              placeholder="192.168.1.0/24"
              className="input-field font-mono" />
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-gray-600 self-center">Examples:</span>
              {EXAMPLES.map(ex => (
                <button key={ex} type="button" onClick={() => setCidr(ex)}
                  className="px-2.5 py-1 bg-gray-800/60 hover:bg-gray-700/60 text-gray-500 hover:text-gray-300 text-xs rounded-lg border border-gray-700/40 transition-all font-mono">
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Calculating...' : 'Calculate Subnet'}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
