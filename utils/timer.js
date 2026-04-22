/**
 * Utility to track execution time of different code blocks
 */
class PerformanceTimer {
    constructor() {
        this.startTime = performance.now();
        this.marks = [];
        this.lastTime = this.startTime;
    }

    /**
     * Mark a point in time
     * @param {string} label - Label for this stage
     */
    mark(label) {
        const now = performance.now();
        const duration = now - this.lastTime;
        const totalDuration = now - this.startTime;
        this.marks.push({ label, duration, totalDuration });
        this.lastTime = now;
    }

    /**
     * Get a formatted report string for Discord
     * @returns {string}
     */
    getReport() {
        if (this.marks.length === 0) return "";
        
        let report = "\n\n**⏱️ Performans Raporu**\n";
        this.marks.forEach(m => {
            report += `> • **${m.label}**: \`${m.duration.toFixed(2)}ms\`\n`;
        });
        
        const total = performance.now() - this.startTime;
        report += `> 🏁 **Toplam Süre**: \`${total.toFixed(2)}ms\``;
        
        return report;
    }
}

module.exports = PerformanceTimer;
