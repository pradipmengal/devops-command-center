import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

const PLATFORMS = [
  { value: 'github_actions', label: 'GitHub Actions', icon: '🐙', file: '.github/workflows/pipeline.yml' },
  { value: 'gitlab_ci',      label: 'GitLab CI',      icon: '🦊', file: '.gitlab-ci.yml' },
  { value: 'jenkins',        label: 'Jenkins',         icon: '🏗️', file: 'Jenkinsfile' },
]

const LANGUAGES = [
  { value: 'nodejs',  label: 'Node.js',   icon: '🟢' },
  { value: 'python',  label: 'Python',    icon: '🐍' },
  { value: 'java',    label: 'Java',      icon: '☕' },
  { value: 'go',      label: 'Go',        icon: '🔵' },
  { value: 'rust',    label: 'Rust',      icon: '🦀' },
  { value: 'dotnet',  label: '.NET / C#', icon: '💜' },
]

const STEPS = [
  { value: 'lint',   label: 'Lint',   icon: '🔍', desc: 'Code quality checks' },
  { value: 'test',   label: 'Test',   icon: '🧪', desc: 'Run test suite' },
  { value: 'build',  label: 'Build',  icon: '🔨', desc: 'Compile / bundle' },
  { value: 'docker', label: 'Docker', icon: '🐳', desc: 'Build & push image' },
  { value: 'deploy', label: 'Deploy', icon: '🚀', desc: 'Deploy to target' },
]

export default function CicdPage() {
  const [platform, setPlatform] = useState('github_actions')
  const [language, setLanguage] = useState('nodejs')
  const [steps, setSteps] = useState(['lint', 'test', 'build'])
  const [dockerImage, setDockerImage] = useState('')
  const [deployTarget, setDeployTarget] = useState('kubernetes')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const toggleStep = s => setSteps(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  const selectedPlatform = PLATFORMS.find(p => p.value === platform)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!steps.length) { setError('Select at least one step.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/cicd/generate', {
        platform, language, steps,
        docker_image: dockerImage || null,
        deploy_target: steps.includes('deploy') ? deployTarget : null,
      })
      if (data.status === 'success') {
        setResult(`# File: ${data.data.filename}\n\n${data.data.pipeline}`)
      } else {
        setError(data.data?.message ?? 'Generation failed')
      }
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🔄" title="CI/CD Pipeline Generator" description="Generate complete pipeline files for GitHub Actions, GitLab CI, or Jenkins with language-specific setup." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Platform */}
          <div>
            <label className="label">Platform</label>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map(({ value, label, icon, file }) => (
                <button key={value} type="button" onClick={() => setPlatform(value)}
                  className={`p-3 rounded-xl text-sm font-medium transition-all text-left ${
                    platform === value
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-gray-800/40 text-gray-400 border border-gray-700/40 hover:text-gray-200'
                  }`}>
                  <p className="text-lg mb-1">{icon}</p>
                  <p className="font-semibold text-xs">{label}</p>
                  <p className="text-[10px] opacity-50 font-mono truncate">{file}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="label">Language</label>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map(({ value, label, icon }) => (
                <button key={value} type="button" onClick={() => setLanguage(value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    language === value
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-gray-800/40 text-gray-400 border border-gray-700/40 hover:text-gray-200'
                  }`}>
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <label className="label">Pipeline Steps</label>
            <div className="grid grid-cols-5 gap-2">
              {STEPS.map(({ value, label, icon, desc }) => (
                <button key={value} type="button" onClick={() => toggleStep(value)}
                  className={`p-3 rounded-xl text-center transition-all ${
                    steps.includes(value)
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-gray-800/40 text-gray-400 border border-gray-700/40 hover:text-gray-200'
                  }`}>
                  <p className="text-lg mb-1">{icon}</p>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[9px] opacity-50 leading-tight">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {steps.includes('docker') && (
            <div>
              <label className="label">Docker Image Name</label>
              <input type="text" value={dockerImage} onChange={e => setDockerImage(e.target.value)}
                placeholder="myorg/my-app" className="input-field font-mono" />
            </div>
          )}

          {steps.includes('deploy') && (
            <div>
              <label className="label">Deploy Target</label>
              <div className="flex gap-2">
                {['kubernetes', 'ec2', 'ecs'].map(t => (
                  <button key={t} type="button" onClick={() => setDeployTarget(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all uppercase tracking-wide ${
                      deployTarget === t
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-gray-800/40 text-gray-400 border border-gray-700/40 hover:text-gray-200'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={loading || !steps.length} className="btn-primary">
            {loading ? 'Generating...' : `Generate ${selectedPlatform?.label ?? ''} Pipeline`}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
