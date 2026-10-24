// Reveal content once as it enters view. Without JavaScript, everything remains visible.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('visible'); observer.unobserve(entry.target);
    }
  }, { threshold: .1 });
  document.querySelectorAll('.reveal').forEach(element => {
    element.classList.add('motion-ready'); observer.observe(element);
  });
}
