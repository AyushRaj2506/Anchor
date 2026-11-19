import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../config/supabase';
import './AnalysisActivity.css';

export default function AnalysisActivity({ user, onResults }) {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const callback = useRef(onResults);
  callback.current = onResults;
  useEffect(() => {
    if (user?.isDemo) { setLoading(false); return; }
    let active = true, timer;
    let signature;
    async function load() {
      try {
        const { data, error: failed } = await supabase.from('ai_jobs')
          .select('id,kind,status,error,created_at,updated_at').eq('user_id', user.uid)
          .order('created_at', { ascending: false }).limit(30);
        if (failed) throw failed;
        if (!active) return;
        setJobs(data); setError('');
        const completed = data.filter(job => job.status === 'succeeded').map(job => job.id + job.updated_at).join(',');
        if (completed && completed !== signature) await callback.current?.();
        signature = completed;
      } catch {
        if (active) setError('Could not refresh analysis activity. Please try again.');
      } finally {
        if (active) { setLoading(false); timer = setTimeout(load, 10000); }
      }
    }
    load();
    return () => { active = false; clearTimeout(timer); };
  }, [user?.uid, user?.isDemo, refresh]);

  const labels = { queued: 'Waiting', processing: 'Analyzing', succeeded: 'Completed', failed: 'Failed' };
  return <main className="analysis-activity" id="main-content" tabIndex={-1}>
    <div className="activity-heading"><div><h1>Analysis Activity</h1>
      <p>Analysis continues when you leave the page. Completed results and action items are saved automatically.</p></div>
      <button className="btn-secondary" onClick={() => setRefresh(value => value + 1)}>Refresh</button></div>
    <p>Recent requests are shown for 7 days. Saved resources and tasks remain in your library.</p>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Loading analysis activity…</p> : !jobs.length ? <p>{user?.isDemo ? 'Sign in to analyze your own resources.' : 'No recent analysis requests. Analyze a resource from your library to get started.'}</p> :
      <ol className="activity-list">{jobs.map(job => <li key={job.id}>
        <div><strong>{job.kind === 'file' ? 'Document analysis' : job.kind === 'url' ? 'Web page analysis' : 'Text analysis'}</strong>
          <span className={'activity-status activity-' + job.status}>{labels[job.status]}</span></div>
        <time dateTime={job.created_at}>{new Date(job.created_at).toLocaleString()}</time>
        {job.error && <p>{job.error}</p>}
        {job.status === 'succeeded' && <p>Results are available on the resource in your library.</p>}
        {job.status === 'failed' && <p>Open the resource and choose Analyze with AI to retry.</p>}
      </li>)}</ol>}
  </main>;
}
