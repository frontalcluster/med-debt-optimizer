# Medical School Debt Optimizer

A client-side tool that compares loan repayment strategies for medical professionals and recommends optimal approaches based on NPV analysis.

## Features

- **Strategy Comparison**: PSLF, PAYE, IBR, SAVE, and refinancing options
- **Specialty-Aware**: Income projections based on 30+ medical specialties
- **Filing Status Optimization**: MFS vs MFJ comparison
- **Tax Impact Modeling**: Estimates tax liability on IDR forgiveness
- **NPV Analysis**: Time-value-of-money adjusted comparisons
- **Privacy-First**: All calculations run client-side, no data sent to servers

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Project Structure

```
med-debt-optimizer/
├── src/
│   ├── core/
│   │   ├── types.ts        # TypeScript interfaces
│   │   ├── constants.ts    # Poverty lines, tax brackets, plan params
│   │   ├── specialties.ts  # Medical specialty salary data
│   │   ├── calculations.ts # Core calculation functions
│   │   └── strategies.ts   # Strategy comparison engine
│   ├── main.ts             # UI logic
│   └── index.ts            # Barrel exports
├── tests/
│   └── calculations.test.ts
├── public/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Key Concepts

### Debt-to-Income Ratio (DTI)

The primary heuristic for strategy selection:
- **DTI < 0.5**: Refinancing likely optimal
- **DTI 0.5-1.5**: Depends on PSLF eligibility and risk tolerance
- **DTI > 1.5**: Forgiveness strategies almost always win

DTI = Total Debt / Expected Attending Salary

### Net Present Value (NPV)

All strategies are compared using NPV with a configurable discount rate (default 5%). This accounts for the time value of money—a dollar paid in year 20 is worth less than a dollar paid today.

NPV includes:
- All loan payments (discounted)
- Tax on forgiveness (for IDR plans, discounted to forgiveness year)

### PSLF Confidence

Rather than treating PSLF as binary, users can input their credence that the program will exist and function as expected (0-100%). This affects recommendation confidence but not NPV calculation directly.

## Data Sources

| Data | Source | Update Frequency |
|------|--------|------------------|
| Poverty guidelines | HHS | Annual (January) |
| Specialty salaries | Medscape/Doximity | Annual |
| Tax brackets | IRS | Annual |
| IDR plan parameters | FSA | As regulations change |

## Deployment

### Static Hosting (Recommended)

The built output is a static site with no server requirements:

```bash
npm run build
# Deploy contents of `dist/` to any static host
```

Recommended hosts (all free tier):
- Cloudflare Pages
- Vercel
- Netlify
- GitHub Pages

### Custom Domain

1. Purchase domain (~$10/year via Namecheap, Cloudflare, etc.)
2. Point DNS to your static host
3. Enable HTTPS (automatic on most platforms)

## Extending the Tool

### Adding a Specialty

Edit `src/core/specialties.ts`:

```typescript
new_specialty: {
  name: 'New Specialty Name',
  medianAttendingSalary: 350000,
  salaryP25: 280000,
  salaryP75: 420000,
  typicalTrainingYears: 4,
  pslfPrevalence: 0.35,
},
```

### Adding a Repayment Plan

1. Add plan parameters to `IDR_PLANS` in `constants.ts`
2. Update `calculateIDRStrategy` in `strategies.ts` if plan has unique rules
3. Add tests

### Updating Annual Data

Each January, update:
1. `POVERTY_LINE_BASE` and `POVERTY_LINE_PER_PERSON` in `constants.ts`
2. `FEDERAL_BRACKETS_*` arrays in `constants.ts`
3. `TRAINING_SALARIES` if resident salaries have changed significantly
4. `SPECIALTIES` data with new Medscape/Doximity figures

## Known Limitations

1. **SAVE Plan**: Currently enjoined by litigation. Set `savePlanAvailable: false` by default.
2. **Spousal Consolidation**: Not modeled (edge case, generally bad idea anyway).
3. **NHSC/Military Programs**: Not included—would need separate module.
4. **State-Specific Forgiveness**: Some states have their own programs—not modeled.
5. **Part-Time PSLF**: Assumes full-time qualifying employment.

## Contributing

1. Validate calculations against known scenarios before making changes
2. Add tests for any new functionality
3. Update this README if adding features

## License

MIT

## Disclaimer

This tool provides estimates for educational purposes only. It is not financial or legal advice. Consult a qualified professional before making decisions about your student loans.
