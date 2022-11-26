import { Component, Input, OnInit } from "@angular/core";
import { MatLegacyDialog as MatDialog } from "@angular/material/legacy-dialog";
import { Store } from "@ngrx/store";
import { orderBy } from "lodash";
import { Observable, zip } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { SystemSettingsService } from "src/app/core/services/system-settings.service";
import { LISConfigurationsModel } from "src/app/modules/laboratory/resources/models/lis-configurations.model";
import { OtherClientLevelSystemsService } from "src/app/modules/laboratory/resources/services/other-client-level-systems.service";
import { SharedConfirmationComponent } from "src/app/shared/components/shared-confirmation /shared-confirmation.component";
import { SharedSamplesVerificationIntegratedComponent } from "src/app/shared/dialogs/shared-samples-verification-integrated/shared-samples-verification-integrated.component";
import { ConceptsService } from "src/app/shared/resources/concepts/services/concepts.service";
import { SamplesService } from "src/app/shared/services/samples.service";
import {
  addLabDepartments,
  loadLabSamplesByCollectionDates,
  setSampleStatus,
} from "src/app/store/actions";
import { AppState } from "src/app/store/reducers";
import {
  getCodedSampleRejectionReassons,
  getFormattedLabSamplesForTracking,
  getFormattedLabSamplesLoadedState,
  getLabConfigurations,
  getLabDepartments,
  getLabSamplesWithResults,
  getSamplesWithResults,
} from "src/app/store/selectors";
import { getLISConfigurations } from "src/app/store/selectors/lis-configurations.selectors";

@Component({
  selector: "app-sample-results-dashboard",
  templateUrl: "./sample-results-dashboard.component.html",
  styleUrls: ["./sample-results-dashboard.component.scss"],
})
export class SampleResultsDashboardComponent implements OnInit {
  @Input() datesParameters: any;
  @Input() patients: any;
  @Input() sampleTypes: any;
  @Input() labSamplesDepartments: any;
  @Input() labSamplesContainers: any;
  @Input() configs: any;
  @Input() codedSampleRejectionReasons: any;
  @Input() LISConfigurations: LISConfigurationsModel;
  @Input() currentUser: any;
  @Input() privileges: any;
  @Input() providerDetails: any;

  labConfigs$: Observable<any>;
  privileges$: Observable<any>;
  codedSampleRejectionReasons$: Observable<any[]>;
  samplesLoadedState$: Observable<any>;
  searchingText: string = "";
  allSamples$: Observable<any[]>;
  selectedDepartment: string = "";
  status: boolean;
  userUuid: any;
  completedSamples$: Observable<any>;
  samplesWithResults$: Observable<any[]>;
  sampleDetailsToggleControl: any = {};
  samplesToViewMoreDetails: any = {};
  saving: boolean = false;
  shouldConfirm: boolean = false;

  externalSystemPayload: any;
  message: any = {};
  testResultsMapping$: Observable<any>;
  externalSystemsReferenceConceptUuid$: Observable<string>;
  constructor(
    private store: Store<AppState>,
    private dialog: MatDialog,
    private samplesService: SamplesService,
    private otherSystemsService: OtherClientLevelSystemsService,
    private conceptService: ConceptsService,
    private systemSettingsService: SystemSettingsService
  ) {}

  ngOnInit(): void {
    this.userUuid = this.currentUser?.uuid;
    this.getCompletedSamples();
    this.testResultsMapping$ =
      this.systemSettingsService.getSystemSettingsByKey(
        "iCare.laboratory.settings.externalSystems.pimaCOVID.testResults.mappingSourceUuid"
      );

    this.externalSystemsReferenceConceptUuid$ =
      this.systemSettingsService.getSystemSettingsByKey(
        "icare.lis.externalSystems.dhis2Based.conceptUuid"
      );
  }

  getCompletedSamples() {
    this.store.dispatch(
      addLabDepartments({ labDepartments: this.labSamplesDepartments })
    );
    this.store.dispatch(
      loadLabSamplesByCollectionDates({
        datesParameters: this.datesParameters,
        patients: this.patients,
        sampleTypes: this.sampleTypes,
        departments: this.labSamplesDepartments,
        containers: this.labSamplesContainers,
        configs: this.configs,
        codedSampleRejectionReasons: this.codedSampleRejectionReasons,
      })
    );

    const moreInfo = {
      patients: this.patients,
      sampleTypes: this.sampleTypes,
      departments: this.labSamplesDepartments,
      containers: this.labSamplesContainers,
      configs: this.configs,
      codedSampleRejectionReasons: this.codedSampleRejectionReasons,
    };

    this.allSamples$ = this.samplesService.getSampleByStatusCategory(
      null,
      "Completed",
      this.datesParameters?.startDate,
      this.datesParameters?.endDate,
      moreInfo
    );
    this.samplesWithResults$ = this.store.select(
      getLabSamplesWithResults(this.selectedDepartment, this.searchingText)
    );
  }

  setDepartment(department) {
    this.selectedDepartment = department;
    this.allSamples$ = this.store.select(getFormattedLabSamplesForTracking, {
      department: this.selectedDepartment,
      searchingText: this.searchingText,
    });
  }

  onSearch(e) {
    if (e) {
      e.stopPropagation();
      this.allSamples$ = this.store.select(getFormattedLabSamplesForTracking, {
        department: this.selectedDepartment,
        searchingText: this.searchingText,
      });
    }
  }

  toggleSampleDetails(event: Event, sample: any): void {
    event.stopPropagation();
    this.sampleDetailsToggleControl[sample?.id] = !this
      .sampleDetailsToggleControl[sample?.id]
      ? true
      : false;
  }

  onUpdateStatus(event: Event, sample: any, key: string): void {
    event.stopPropagation();
    const confirmDialog = this.dialog.open(SharedConfirmationComponent, {
      width: "25%",
      data: {
        modalTitle: `${key} sample results`,
        modalMessage: `Are you sure to ${key} results of ${sample?.label} for external use?`,
        showRemarksInput: true,
      },
      disableClose: false,
      panelClass: "custom-dialog-container",
    });

    confirmDialog.afterClosed().subscribe((res) => {
      if (res.confirmed && key === "release") {
        const sampleStatus = {
          sample: {
            uuid: sample?.uuid,
          },
          user: {
            uuid: this.userUuid,
          },
          remarks: res?.remarks,
          status: "RELEASED",
          category: "RELEASED",
        };

        this.samplesService
          .setSampleStatus(sampleStatus)
          .subscribe((response) => {
            if (response.error) {
              // console.log("Error: " + response.error);
            }
            if (!response.error) {
              // console.log("Response: " + response);
            }
          });
      }
      if (res.confirmed && key === "restrict") {
        const sampleStatus = {
          sample: {
            uuid: sample?.uuid,
          },
          user: {
            uuid: this.userUuid,
          },
          remarks: res?.remarks,
          status: "RESTRICTED",
          category: "RESTRICTED",
        };
        this.samplesService
          .setSampleStatus(sampleStatus)
          .subscribe((response) => {
            if (response.error) {
              // console.log("Error: " + response.error);
            }
            if (!response.error) {
              // console.log("Response: " + response);
            }
          });
      }
      this.getCompletedSamples();
    });
  }

  onToggleViewSampleDetails(event: Event, sample: any): void {
    event.stopPropagation();
    this.samplesToViewMoreDetails[sample?.id] = !this.samplesToViewMoreDetails[
      sample?.id
    ]
      ? sample
      : null;
  }

  onGetVisitDetails(visitDetails): void {
    const matchedAttribute = (visitDetails?.attributes?.filter(
      (attribute) =>
        attribute?.attributeType?.uuid ===
        "0acd3180-710d-4417-8768-97bc45a02395"
    ) || [])[0];
    this.externalSystemPayload = matchedAttribute
      ? JSON.parse(matchedAttribute?.value)
      : null;
  }

  onSend(
    event: Event,
    sample: any,
    confirmed?: boolean,
    testResultsMapping?: string
  ): void {
    event.stopPropagation();
    if (confirmed) {
      const result = orderBy(
        (sample?.ordersWithResults[0]?.testAllocations?.filter(
          (allocation) =>
            allocation?.concept?.uuid === "9c657ac6-deed-4167-b7ea-a2d794c3c66e"
        ) || [])[0]?.results,
        ["dateCreated"],
        ["desc"]
      )[0]?.valueCoded;

      const resultUuid = result?.uuid;
      // const diaplayValue = result?.display;
      this.conceptService
        .getConceptDetailsByUuid(
          resultUuid,
          "custom:(uuid,display,mappings:(display,conceptReferenceTerm:(uuid,name,code,conceptSource)))"
        )
        .subscribe((response) => {
          if (response && !response?.error) {
            if (response?.mappings?.length > 0) {
              const mapping = (response?.mappings?.filter(
                (mapping) =>
                  mapping?.conceptReferenceTerm?.conceptSource?.uuid ===
                  testResultsMapping
              ) || [])[0];
              const mappedResult = mapping?.conceptReferenceTerm?.code;
              if (mappedResult) {
                this.shouldConfirm = false;
                this.saving = true;
                const sampleStatus = {
                  sample: {
                    uuid: sample?.uuid,
                  },
                  user: {
                    uuid: this.userUuid,
                  },
                  remarks: "SENT TO PIMACOVID SYSTEM",
                  category: "RESULTS_INTEGRATION",
                  status: "RESULTS_INTEGRATION",
                };

                const data = this.createResultsPayload(
                  this.externalSystemPayload,
                  mappedResult
                );
                const requests = [
                  this.otherSystemsService.sendLabResult(data),
                  this.samplesService.setSampleStatus(sampleStatus),
                ];
                zip(
                  ...requests.map((request) => {
                    return request;
                  })
                ).subscribe((response) => {
                  if (response) {
                    this.saving = false;
                  }
                });
              } else {
                this.message[sample?.id] =
                  "Answer has not been maaped on LIS settings, contact IT/Section Manager";
                setTimeout(() => {
                  this.message[sample?.id] = null;
                }, 2000);
              }
            } else {
              this.message =
                "Missing mappings with PimaCOVID System, contact IT/Section Manager";
              setTimeout(() => {
                this.message = "";
              }, 2000);
            }
          }
        });
    } else {
      this.message[sample?.id] = "Please Confirm";
      this.shouldConfirm = true;
    }
  }

  createResultsPayload(referencePayload: any, mappedResult: string): any {
    const labResultPayload = {
      program: referencePayload?.program,
      programStage: "QreyZUwCOlg",
      orgUnit: referencePayload?.orgUnit,
      trackedEntityInstance: referencePayload?.trackedEntityInstance,
      enrollment: referencePayload?.enrollment,
      dataValues: [
        { dataElement: "Cl2I1H6Y3oj", value: new Date().toISOString() },
        { dataElement: "ovY6E8BSdto", value: mappedResult },
        { dataElement: "eDrW5iJLYbP", value: "PCR" },
      ],
      eventDate: new Date().toISOString(),
    };
    return labResultPayload;
  }

  onVerifyIfIsFromExternalSystem(
    event: Event,
    sample: any,
    externalSystemsReferenceConceptUuid: string
  ): void {
    event.stopPropagation();
    this.dialog
      .open(SharedSamplesVerificationIntegratedComponent, {
        width: "50%",
        data: {
          ...sample,
          externalSystemsReferenceConceptUuid,
        },
      })
      .afterClosed()
      .subscribe(() => {
        this.samplesToViewMoreDetails[sample?.id] = null;
        setTimeout(() => {
          this.samplesToViewMoreDetails[sample?.id] = sample;
        }, 100);
      });
  }
}
